-- =============================================================================
-- QUERY UNIFICADA — Reporte CRM de Sociedades
-- =============================================================================
-- Merge de Q1 (CRM Operativo) + Q2 (CI Detalle) + Q3 (Ofrecimientos) + Q4 (Financiero)
-- Q2 y Q3 ya cubiertas por CTEs agregados de Q1 (cis_fae/inv, concrecion_gral)
-- Filtro por Asociado Comercial / Representante via filtro_param CTE
-- =============================================================================

WITH

-- ─────────────────────────────────────────────────
-- 0a. PARÁMETRO DE FILTRO (se define 1 sola vez para evitar error JDBC)
-- ─────────────────────────────────────────────────
filtro_param AS (
    SELECT {{filtro_usuario}} AS user_id
),

-- ─────────────────────────────────────────────────
-- 0b. SOCIEDADES PRE-FILTRADAS
--     Cuando user_id = 0 → todas las sociedades activas
--     Cuando user_id > 0 → solo las del AC o representante indicado
--     Este CTE elimina full-table scans en todos los CTEs pesados
-- ─────────────────────────────────────────────────
soc_ids AS (
    SELECT DISTINCT st.id
    FROM dcac.sociedades_tags st
    LEFT JOIN dcac.rel_usuarios_sociedades rus_f 
        ON st.id = rus_f.sociedad AND rus_f.estado = 0 AND rus_f.usuario != 0
    LEFT JOIN dcac.clientes_x_representantes cxr_f ON cxr_f.cliente = rus_f.usuario
    LEFT JOIN dcac.representantes r_f ON r_f.usuario = cxr_f.representante
    WHERE st.estado = 0
      AND (
          (SELECT user_id FROM filtro_param) = 0
          OR st.asociado_comercial = (SELECT user_id FROM filtro_param)
          OR r_f.usuario = (SELECT user_id FROM filtro_param)
      )
),

-- ─────────────────────────────────────────────────
-- 1. OFRECIMIENTOS NO CONCRETADOS - INVERNADA
-- ─────────────────────────────────────────────────
ofrec_inv AS (
    SELECT 
        r_main.sociedad_vendedora,
        agg.q_ofrec_inv,
        DATE(r_main.fecha_hora) AS ult_noconc_inv
    FROM (
        SELECT 
            r.sociedad_vendedora, 
            SUM(r.cantidad) AS q_ofrec_inv, 
            MAX(r.revisacion) AS max_id
        FROM dcac.revisaciones r 
        INNER JOIN dcac.sociedades_tags st ON r.sociedad_vendedora = st.id AND st.estado = 0
        WHERE r.estado = 7 
          AND r.sociedad_vendedora > 0
          AND r.sociedad_vendedora IN (SELECT id FROM soc_ids)
        GROUP BY r.sociedad_vendedora
    ) agg
    INNER JOIN dcac.revisaciones r_main ON agg.max_id = r_main.revisacion
),

-- ─────────────────────────────────────────────────
-- 2. OFRECIMIENTOS NO CONCRETADOS - FAENA
-- ─────────────────────────────────────────────────
ofrec_fae AS (
    SELECT 
        agg.sociedad_vendedora,
        agg.q_ofrec_fae,
        DATE(n_main.fecha) AS ult_noconc_fae
    FROM (
        SELECT 
            n.sociedad_vendedora, 
            SUM(CASE 
                WHEN ib.jaula_cantidad = 0 AND ib.jaula_tipo = 1 THEN 35 
                WHEN ib.jaula_cantidad = 0 AND ib.jaula_tipo = 2 THEN 50 
                WHEN ib.jaula_cantidad > 0 AND ib.jaula_tipo = 1 THEN ib.jaula_cantidad * 35 
                WHEN ib.jaula_cantidad <> 0 AND ib.jaula_tipo = 2 THEN ib.jaula_cantidad * 50
            END) AS q_ofrec_fae,
            MAX(n.id) AS max_id
        FROM dcac.negocios n
        INNER JOIN dcac.informes_baja ib ON n.id = ib.negocio AND ib.negocio > 0
        INNER JOIN dcac.sociedades_tags st ON n.sociedad_vendedora = st.id AND st.estado = 0
        WHERE n.no_concretado = 1 
          AND n.directo = 1 
          AND n.borrado <> 1 
          AND n.sociedad_vendedora > 0
          AND n.sociedad_vendedora IN (SELECT id FROM soc_ids)
        GROUP BY n.sociedad_vendedora
    ) agg
    INNER JOIN dcac.negocios n_main ON agg.max_id = n_main.id
),

-- ─────────────────────────────────────────────────
-- 3. REPRESENTANTE VINCULADO (+ usuario ID para filtro)
-- ─────────────────────────────────────────────────
repre_vinc AS (
    SELECT DISTINCT 
        ST.id, 
        ST.razon_social, 
        CONCAT(R.nombre, ' ', R.apellido) AS representante,
        R.usuario AS usuario_representante
    FROM dcac.rel_usuarios_sociedades RUS
    INNER JOIN dcac.clientes_x_representantes CXR ON CXR.cliente = RUS.usuario 
    INNER JOIN dcac.representantes R ON R.usuario = CXR.representante
    INNER JOIN dcac.sociedades_tags ST ON ST.id = RUS.sociedad AND ST.estado = 0
    WHERE RUS.usuario != 0 
      AND RUS.estado = 0
      AND ST.id IN (SELECT id FROM soc_ids)
),

-- ─────────────────────────────────────────────────
-- 4. VENTAS FAENA (cantidad + última fecha)
-- ─────────────────────────────────────────────────
aux_vend_fae AS (
    SELECT 
        agg.sociedad_vendedora, 
        agg.q_ventas_fae, 
        DATE(liq.fecha_faena) AS fecha_venta_fae
    FROM (
        SELECT 
            n.sociedad_vendedora, 
            SUM(liq.cantidad_liquidada) AS q_ventas_fae, 
            MAX(n.id) AS max_id
        FROM dcac.negocios n
        INNER JOIN negocios.liquidaciones liq ON n.id = liq.negocio AND liq.sociedad_compradora > 0
        INNER JOIN negocios.liquidacion_oficial lo ON n.id = lo.lo_negocio AND lo.lo_tipo_liquid = 'interna'
        WHERE n.tipo IN (8, 3, 9, 7, 4, 5)
          AND n.directo = 1
          AND n.borrado != 1
          AND n.no_concretado != 1 
          AND n.sociedad_vendedora > 0
          AND n.sociedad_vendedora IN (SELECT id FROM soc_ids)
        GROUP BY n.sociedad_vendedora
    ) agg
    INNER JOIN negocios.liquidaciones liq ON agg.max_id = liq.negocio
),

-- ─────────────────────────────────────────────────
-- 5. VENTAS INVERNADA (cantidad + última fecha)
-- ─────────────────────────────────────────────────
aux_vend_inv AS (
    SELECT 
        agg.sociedad_vendedora, 
        agg.q_ventas_inv,
        CASE 
            WHEN DATE(dc_main.fecha_carga_final) != '0000-00-00' AND dc_main.fecha_carga_final IS NOT NULL 
            THEN DATE(dc_main.fecha_carga_final)
            ELSE DATE(dc_main.fecha_carga) 
        END AS fecha_venta_inv
    FROM (
        SELECT 
            r.sociedad_vendedora, 
            SUM(dc.cantidad_animales) AS q_ventas_inv, 
            MAX(r.revisacion) AS max_id
        FROM dcac.revisaciones r
        INNER JOIN dcac.detalles_carga dc ON r.revisacion = dc.revisacion
        WHERE r.estado = 4 
          AND r.estado_b IN (0,2,3,4,5,6) 
          AND r.no_concretado = 0 
          AND r.sociedad_vendedora > 0
          AND r.sociedad_vendedora IN (SELECT id FROM soc_ids)
          AND COALESCE(
                NULLIF(DATE(dc.fecha_carga_final), '0000-00-00'), 
                DATE(dc.fecha_carga)
              ) IS NOT NULL
        GROUP BY r.sociedad_vendedora
    ) agg
    INNER JOIN dcac.detalles_carga dc_main ON agg.max_id = dc_main.revisacion
),

-- ─────────────────────────────────────────────────
-- 6. COMPRAS FAENA
-- ─────────────────────────────────────────────────
aux_comp_fae AS (
    SELECT 
        agg.sociedad_compradora, 
        agg.q_compras_fae, 
        DATE(liq.fecha_faena) AS fecha_compra_fae
    FROM (
        SELECT 
            liq.sociedad_compradora, 
            SUM(liq.cantidad_liquidada) AS q_compras_fae, 
            MAX(n.id) AS max_id
        FROM dcac.negocios n
        INNER JOIN negocios.liquidaciones liq ON n.id = liq.negocio AND liq.sociedad_compradora > 0
        INNER JOIN negocios.liquidacion_oficial lo ON n.id = lo.lo_negocio AND lo.lo_tipo_liquid = 'interna'
        WHERE n.tipo IN (8, 3, 9, 7, 4, 5)
          AND n.directo = 1
          AND n.borrado != 1
          AND n.no_concretado != 1 
          AND n.sociedad_vendedora > 0
          AND liq.sociedad_compradora IN (SELECT id FROM soc_ids)
        GROUP BY liq.sociedad_compradora
    ) agg
    INNER JOIN negocios.liquidaciones liq ON agg.max_id = liq.negocio
),

-- ─────────────────────────────────────────────────
-- 7. COMPRAS INVERNADA
-- ─────────────────────────────────────────────────
aux_comp_inv AS (
    SELECT 
        agg.sociedad_compradora, 
        agg.q_compras_inv,
        CASE 
            WHEN DATE(dc_main.fecha_carga_final) != '0000-00-00' AND dc_main.fecha_carga_final IS NOT NULL 
            THEN DATE(dc_main.fecha_carga_final)
            ELSE DATE(dc_main.fecha_carga) 
        END AS fecha_compra_inv
    FROM (
        SELECT 
            lxi.sociedad_compradora, 
            SUM(dc.cantidad_animales) AS q_compras_inv, 
            MAX(r.revisacion) AS max_id
        FROM dcac.revisaciones r
        INNER JOIN dcac.detalles_carga dc ON r.revisacion = dc.revisacion
        INNER JOIN dcac.lotes_x_interesados lxi ON r.revisacion = lxi.revisacion
        WHERE r.estado = 4 
          AND r.estado_b IN (0,2,3,4,5,6) 
          AND r.no_concretado = 0 
          AND r.sociedad_vendedora > 0
          AND lxi.sociedad_compradora IN (SELECT id FROM soc_ids)
          AND COALESCE(
                NULLIF(DATE(dc.fecha_carga_final), '0000-00-00'), 
                DATE(dc.fecha_carga)
              ) IS NOT NULL
        GROUP BY lxi.sociedad_compradora
    ) agg
    INNER JOIN dcac.detalles_carga dc_main ON agg.max_id = dc_main.revisacion
),

-- ─────────────────────────────────────────────────
-- 8. CONCRECIÓN GENERAL (Faena + Invernada)
-- ─────────────────────────────────────────────────
concrecion_gral AS (
    SELECT 
        id_soc,
        sociedad_vendedora AS sociedad,
        SUM(Concretadas_Fae) AS sum_Concretadas_Fae,
        SUM(No_concretadas_Fae) AS sum_No_concretadas_Fae,
        IFNULL(SUM(Concretadas_Fae),0) + IFNULL(SUM(No_concretadas_Fae),0) + IFNULL(SUM(Publicadas_Fae),0) AS Ofrecimientos_Fae,
        SUM(Concretadas_Fae) / NULLIF(SUM(Concretadas_Fae) + IFNULL(SUM(No_concretadas_Fae), 0), 0) AS conc_gral_fae,
        SUM(Concretadas_Inv) AS sum_Concretadas_Inv,
        SUM(No_concretadas_Inv) AS sum_No_concretadas_Inv,
        IFNULL(SUM(Concretadas_Inv),0) + IFNULL(SUM(No_concretadas_Inv),0) + IFNULL(SUM(Publicadas_Inv),0) AS Ofrecimientos_Inv,
        SUM(Concretadas_Inv) / NULLIF(SUM(Concretadas_Inv) + IFNULL(SUM(No_concretadas_Inv), 0), 0) AS conc_gral_inv,
        SUM(Concretadas_Tot) / NULLIF(SUM(Concretadas_Tot) + IFNULL(SUM(No_Concretadas_Tot), 0), 0) AS conc_gral
    FROM (
        -- INVERNADA
        SELECT 
            sv.id AS id_soc, 
            sv.razon_social AS sociedad_vendedora,
            CASE WHEN r.estado = 4 AND r.no_concretado = 0 THEN 1 END AS Concretadas_Inv,
            CASE WHEN r.estado IN (1,3,4,11,12) THEN 1 END AS Publicadas_Inv,
            CASE WHEN r.estado = 7 THEN 1 END AS No_concretadas_Inv,
            NULL AS Concretadas_Fae,
            NULL AS Publicadas_Fae,
            NULL AS No_concretadas_Fae,
            CASE WHEN r.estado = 4 AND r.no_concretado = 0 THEN 1 END AS Concretadas_Tot,
            CASE WHEN r.estado = 7 THEN 1 END AS No_Concretadas_Tot
        FROM dcac.revisaciones r
        INNER JOIN dcac.sociedades_tags sv ON r.sociedad_vendedora = sv.id
        WHERE sv.razon_social IS NOT NULL AND sv.razon_social != ''
          AND r.estado IN (1, 3, 4, 5, 7, 11, 12)
          AND sv.id IN (SELECT id FROM soc_ids)

        UNION ALL

        -- FAENA
        SELECT 
            sv.id AS id_soc, 
            sv.razon_social AS sociedad_vendedora,
            NULL AS Concretadas_Inv,
            NULL AS Publicadas_Inv,
            NULL AS No_concretadas_Inv,
            CASE WHEN n.tipo IN (3,4,5,7,8,9) AND n.borrado != 1 AND n.no_concretado != 1 THEN 1 END AS Concretadas_Fae,
            CASE WHEN n.tipo IN (0,10,11,12) AND n.borrado != 1 AND n.no_concretado != 1 THEN 1 END AS Publicadas_Fae,
            CASE WHEN n.no_concretado = 1 THEN 1 END AS No_concretadas_Fae,
            CASE WHEN n.tipo IN (3,4,5,7,8,9) AND n.borrado != 1 AND n.no_concretado != 1 THEN 1 END AS Concretadas_Tot,
            CASE WHEN n.no_concretado = 1 THEN 1 END AS No_Concretadas_Tot
        FROM dcac.negocios n
        INNER JOIN dcac.sociedades_tags sv ON n.sociedad_vendedora = sv.id
        WHERE n.directo = 1 
          AND sv.razon_social IS NOT NULL AND sv.razon_social != ''
          AND sv.id IN (SELECT id FROM soc_ids)
          AND (   (n.tipo IN (3,4,5,7,8,9) AND n.borrado != 1 AND n.no_concretado != 1)
               OR n.borrado = 1
               OR n.no_concretado = 1
               OR (n.tipo IN (0,10,11,12) AND n.borrado != 1 AND n.no_concretado != 1)
          )
    ) datitos
    GROUP BY id_soc, sociedad_vendedora
),

-- ─────────────────────────────────────────────────
-- 9. CONCRECIÓN ÚLTIMAS 5 OPERACIONES
-- ─────────────────────────────────────────────────
concrecion_base AS (
    -- Invernada
    SELECT 
        sv.id AS id_soc, 
        sv.razon_social AS sociedad_vendedora,
        r.revisacion AS lote_id,
        'Invernada' AS Tipo,
        CASE WHEN r.estado = 4 AND r.no_concretado = 0 THEN 'Concretadas'
             WHEN r.estado = 7 THEN 'No Concretadas'
        END AS Estado,
        DATE(r.fecha_publicacion) AS fecha
    FROM dcac.revisaciones r
    INNER JOIN dcac.sociedades_tags sv ON r.sociedad_vendedora = sv.id
    WHERE sv.razon_social IS NOT NULL AND sv.razon_social != ''
      AND sv.id IN (SELECT id FROM soc_ids)
      AND ((r.estado = 4 AND r.no_concretado = 0) OR r.estado = 7)

    UNION ALL

    -- Faena
    SELECT 
        sv.id AS id_soc, 
        sv.razon_social AS sociedad_vendedora,
        n.id AS lote_id,
        'Faena' AS Tipo,
        CASE WHEN n.tipo IN (3,4,5,7,8,9) AND n.borrado != 1 AND n.no_concretado != 1 THEN 'Concretadas'
             WHEN n.no_concretado = 1 THEN 'No Concretadas'
        END AS Estado,
        DATE(n.fecha_publicacion) AS fecha
    FROM dcac.negocios n
    INNER JOIN dcac.sociedades_tags sv ON n.sociedad_vendedora = sv.id
    WHERE n.directo = 1 
      AND sv.razon_social IS NOT NULL AND sv.razon_social != ''
      AND sv.id IN (SELECT id FROM soc_ids)
      AND (  (n.tipo IN (3,4,5,7,8,9) AND n.borrado != 1 AND n.no_concretado != 1)
          OR n.no_concretado = 1)
),

concrecion_ranked AS (
    SELECT 
        id_soc, sociedad_vendedora, Tipo, Estado, fecha,
        ROW_NUMBER() OVER (PARTITION BY id_soc, Tipo ORDER BY fecha DESC) AS rn_tipo,
        ROW_NUMBER() OVER (PARTITION BY id_soc ORDER BY fecha DESC) AS rn_total
    FROM concrecion_base
    WHERE Estado IN ('Concretadas', 'No Concretadas')
),

concrecion_ult_5 AS (
    SELECT 
        sfi.id_soc,
        sfi.sociedad_vendedora,
        IFNULL(sfi.Concretadas_Fae / NULLIF(sfi.Concretadas_Fae + IFNULL(sfi.No_concretadas_Fae, 0), 0), 0) AS porc_conc_5_Fae,
        IFNULL(sfi.Concretadas_Inv / NULLIF(sfi.Concretadas_Inv + IFNULL(sfi.No_concretadas_Inv, 0), 0), 0) AS porc_conc_5_Inv,
        IFNULL(st2.Concretadas_Tot / NULLIF(st2.Concretadas_Tot + IFNULL(st2.No_concretadas_Tot, 0), 0), 0) AS porc_conc_5_Tot
    FROM (
        SELECT 
            id_soc, sociedad_vendedora,
            SUM(CASE WHEN Tipo = 'Faena' AND Estado = 'Concretadas' THEN 1 ELSE 0 END) AS Concretadas_Fae,
            SUM(CASE WHEN Tipo = 'Faena' AND Estado = 'No Concretadas' THEN 1 ELSE 0 END) AS No_concretadas_Fae,
            SUM(CASE WHEN Tipo = 'Invernada' AND Estado = 'Concretadas' THEN 1 ELSE 0 END) AS Concretadas_Inv,
            SUM(CASE WHEN Tipo = 'Invernada' AND Estado = 'No Concretadas' THEN 1 ELSE 0 END) AS No_concretadas_Inv
        FROM concrecion_ranked
        WHERE rn_tipo <= 5
        GROUP BY id_soc, sociedad_vendedora
    ) sfi
    INNER JOIN (
        SELECT 
            id_soc, sociedad_vendedora,
            SUM(CASE WHEN Estado = 'Concretadas' THEN 1 ELSE 0 END) AS Concretadas_Tot,
            SUM(CASE WHEN Estado = 'No Concretadas' THEN 1 ELSE 0 END) AS No_concretadas_Tot
        FROM concrecion_ranked
        WHERE rn_total <= 5
        GROUP BY id_soc, sociedad_vendedora
    ) st2 ON sfi.id_soc = st2.id_soc
),

-- ─────────────────────────────────────────────────
-- 10. INFO COMPRA INMEDIATA
-- ─────────────────────────────────────────────────
info_compra AS (
    SELECT 
        lxi.sociedad_compradora AS id_soc, 
        st.razon_social AS sociedad_compradora,
        COUNT(DISTINCT r.revisacion) AS cis_compradas, 
        DATEDIFF(CURDATE(), MAX(r.comprado_fecha)) AS FUC
    FROM dcac.revisaciones r
    INNER JOIN dcac.lotes_x_interesados lxi ON r.revisacion = lxi.revisacion
    INNER JOIN dcac.sociedades_tags st ON lxi.sociedad_compradora = st.id
    WHERE st.sugerido_ci_invernada = 1 
      AND st.asociado_comercial > 0
      AND r.estado = 4 
      AND r.no_concretado = 0 
      AND DATE(r.comprado_fecha) <> '0000-00-00'
      AND lxi.sociedad_compradora IN (SELECT id FROM soc_ids)
    GROUP BY lxi.sociedad_compradora, st.razon_social
),

-- ─────────────────────────────────────────────────
-- 11. INFO ENVÍOS CI
-- ─────────────────────────────────────────────────
info_envios AS (
    SELECT ci.sociedad, COUNT(DISTINCT cil.lote_id) AS cis_enviadas
    FROM dcac.compra_inmediata ci
    INNER JOIN dcac.compra_inmediata_logs cil ON ci.id = cil.ci_id AND cil.evento = 2
    WHERE ci.sociedad > 0
      AND ci.sociedad IN (SELECT id FROM soc_ids)
    GROUP BY ci.sociedad
),

-- ─────────────────────────────────────────────────
-- 12. INFO VISTAS CI
-- ─────────────────────────────────────────────────
info_vistas AS (
    SELECT ci.sociedad, COUNT(DISTINCT cil.lote_id) AS cis_vistas
    FROM dcac.compra_inmediata ci
    INNER JOIN dcac.compra_inmediata_logs cil ON ci.id = cil.ci_id AND cil.evento = 1
    WHERE ci.sociedad > 0
      AND ci.sociedad IN (SELECT id FROM soc_ids)
    GROUP BY ci.sociedad
),

-- ─────────────────────────────────────────────────
-- 13. CIS COMPRADAS INVERNADA
-- ─────────────────────────────────────────────────
cis_inv AS (
    SELECT sociedad, COUNT(revisacion) AS cis_com_inv
    FROM dcac.compra_inmediata 
    WHERE comprada = 1
      AND sociedad IN (SELECT id FROM soc_ids)
    GROUP BY sociedad
),

-- ─────────────────────────────────────────────────
-- 14. CIS COMPRADAS FAENA
-- ─────────────────────────────────────────────────
cis_fae AS (
    SELECT sociedad, COUNT(negocio) AS cis_com_fae
    FROM negocios.compra_inmediata_faena 
    WHERE comprada = 1 
      AND DATE(fecha_creacion) >= '2024-05-01'
      AND sociedad IN (SELECT id FROM soc_ids)
    GROUP BY sociedad
),

-- ─────────────────────────────────────────────────
-- 15. USUARIOS VINCULADOS (primer usuario + cantidad)
-- ─────────────────────────────────────────────────
usuarios_vinc AS (
    SELECT 
        ranked.id, 
        ranked.razon_social, 
        totals.q_usuarios, 
        ranked.usuarios
    FROM (
        SELECT 
            st.id, 
            st.razon_social, 
            CONCAT(us.nombre, ' ', us.apellido) AS usuarios, 
            rus.nivel,
            ROW_NUMBER() OVER (PARTITION BY st.id ORDER BY rus.nivel, us.cliente DESC) AS rn
        FROM dcac.sociedades_tags st
        INNER JOIN dcac.rel_usuarios_sociedades rus ON st.id = rus.sociedad AND rus.estado = 0
        INNER JOIN dcac.clientes us ON rus.usuario = us.cliente
        WHERE st.id IN (SELECT id FROM soc_ids)
    ) ranked
    INNER JOIN (
        SELECT st.id, COUNT(*) AS q_usuarios
        FROM dcac.sociedades_tags st
        INNER JOIN dcac.rel_usuarios_sociedades rus ON st.id = rus.sociedad AND rus.estado = 0
        WHERE st.id IN (SELECT id FROM soc_ids)
        GROUP BY st.id
    ) totals ON ranked.id = totals.id
    WHERE ranked.rn = 1
),

-- ─────────────────────────────────────────────────
-- 16. ÚLTIMO INGRESO
-- ─────────────────────────────────────────────────
ult_ingreso AS (
    SELECT 
        rus.sociedad, 
        MAX(
            CASE 
                WHEN DATE(u.ultimo_ingreso) <> '0000-00-00' AND TIMESTAMP(u.ultimo_ingreso) > TIMESTAMP(u.ultimo_ingreso_mobile)
                THEN TIMESTAMP(u.ultimo_ingreso) 
                ELSE TIMESTAMP(u.ultimo_ingreso_mobile)
            END
        ) AS ult_ingreso
    FROM dcac.rel_usuarios_sociedades rus
    INNER JOIN dcac.clientes c ON rus.usuario = c.cliente
    INNER JOIN dcac.usuarios u ON c.usuario = u.usuario
    WHERE u.deshabilitado = 0 
      AND u.perfil = 3
      AND CONCAT(u.nombre, ' ', u.apellido) <> ''
      AND rus.sociedad IN (SELECT id FROM soc_ids)
      AND COALESCE(
            NULLIF(DATE(u.ultimo_ingreso), '0000-00-00'),
            NULLIF(DATE(u.ultimo_ingreso_mobile), '0000-00-00')
          ) IS NOT NULL
    GROUP BY rus.sociedad
),

-- ─────────────────────────────────────────────────
-- 17. ÚLTIMA OFERTA
-- ─────────────────────────────────────────────────
ofertas AS (
    SELECT o.sociedad, MAX(DATE(o.fecha)) AS ult_oferta
    FROM dcac.ofertas o 
    INNER JOIN dcac.sociedades_tags st ON o.sociedad = st.id AND st.estado = 0
    WHERE o.sociedad > 0
      AND o.sociedad IN (SELECT id FROM soc_ids)
    GROUP BY o.sociedad
),

-- ─────────────────────────────────────────────────
-- 18. FINANCIERO: TRANSACCIONES EN FECHA (de Q4)
-- ─────────────────────────────────────────────────
consultaEnFecha AS (
    SELECT 
        ft.Sociedad_ID,
        SUM(ft.valor) AS ValorEnFecha
    FROM financiero.transacciones ft
    WHERE ft.interes = 0 
      AND ft.concepto_ref <> 'AFIP' 
      AND ft.estado IN ('autorizado', 'completada') 
      AND ft.fecha_eliminacion IS NULL
      AND ft.tasa_interes_anual IS NULL
      AND ft.Sociedad_ID IN (SELECT id FROM soc_ids)
    GROUP BY ft.Sociedad_ID
),

-- ─────────────────────────────────────────────────
-- 19. FINANCIERO: TRANSACCIONES CAPITAL PROPIO (de Q4)
-- ─────────────────────────────────────────────────
consultaPropio AS (
    SELECT 
        ft.Sociedad_ID,
        SUM(ft.valor) AS ValorPropio
    FROM financiero.transacciones ft
    WHERE ft.metodo_pago_id = 1 
      AND ft.concepto_ref <> 'AFIP' 
      AND ft.estado IN ('autorizado', 'completada') 
      AND ft.fecha_eliminacion IS NULL
      AND ft.tasa_interes_anual IS NULL
      AND ft.Sociedad_ID IN (SELECT id FROM soc_ids)
    GROUP BY ft.Sociedad_ID
),

-- ─────────────────────────────────────────────────
-- 20. FINANCIERO: VENCIMIENTOS (de Q4)
-- ─────────────────────────────────────────────────
vencimientos AS (
    SELECT 
        fo.Sociedad_ID, 
        SUM(
            CASE 
                WHEN foh.lote_tipo IN ('invernada','mag') THEN Valor_original 
                ELSE Valor_original / 1.105 
            END
        ) AS SumaVencimientos
    FROM financiero.operaciones fo
    INNER JOIN financiero.operaciones_hacienda foh ON foh.operacion_id = fo.id
    WHERE fo.fecha_eliminacion IS NULL
      AND fo.Sociedad_ID IN (SELECT id FROM soc_ids)
    GROUP BY fo.Sociedad_ID
)

-- =============================================================================
-- SELECT PRINCIPAL UNIFICADO
-- =============================================================================
SELECT 
    st.id, 
    st.razon_social, 
    DATE(st.fecha_creacion) AS fecha_creacion, 
    prov.descripcion AS Prov_direc_fisc, 
    st.cuit, 
    st.sugerido_ci_faena, 
    st.sugerido_ci_invernada,
    CONCAT(ac.nombre, ' ', ac.apellido) AS asociado_comercial,
    repre_vinc.representante,
    
    -- ── Cantidades de operaciones ──
    aux_comp_fae.q_compras_fae, 
    aux_vend_fae.q_ventas_fae, 
    aux_comp_inv.q_compras_inv, 
    aux_vend_inv.q_ventas_inv,
    
    -- ── Fecha última compra (la más reciente entre inv y fae) ──
    CASE 
        WHEN aux_comp_inv.fecha_compra_inv IS NULL OR DATE(aux_comp_inv.fecha_compra_inv) < DATE(aux_comp_fae.fecha_compra_fae) 
        THEN DATE(aux_comp_fae.fecha_compra_fae) 
        ELSE DATE(aux_comp_inv.fecha_compra_inv) 
    END AS FUC,
    
    DATE(aux_vend_inv.fecha_venta_inv) AS FUV_inv,
    DATE(aux_vend_fae.fecha_venta_fae) AS FUV_fae,
    
    -- ── Concreción general ──
    concrecion_gral.conc_gral_inv, 
    concrecion_gral.conc_gral_fae, 
    concrecion_gral.conc_gral,
    
    -- ── Concreción últimas 5 ──
    NULLIF(concrecion_ult_5.porc_conc_5_Inv, 0) AS porc_conc_5_Inv,
    NULLIF(concrecion_ult_5.porc_conc_5_Fae, 0) AS porc_conc_5_Fae,
    NULLIF(concrecion_ult_5.porc_conc_5_Tot, 0) AS porc_conc_5_Tot,
    
    -- ── Ofrecimientos totales ──
    IFNULL(ofrec_inv.q_ofrec_inv, 0) + IFNULL(aux_vend_inv.q_ventas_inv, 0) AS q_ofrec_inv,
    IFNULL(ofrec_fae.q_ofrec_fae, 0) + IFNULL(aux_vend_fae.q_ventas_fae, 0) AS q_ofrec_fae,
    
    -- ── Compra Inmediata ──
    cis_fae.cis_com_fae,
    cis_inv.cis_com_inv,
    
    -- ── Actividad ──
    DATE(ult_ingreso.ult_ingreso) AS ult_ingreso,
    
    (IFNULL(aux_vend_fae.q_ventas_fae, 0) + IFNULL(aux_vend_inv.q_ventas_inv, 0) 
     + IFNULL(aux_comp_fae.q_compras_fae, 0) + IFNULL(aux_comp_inv.q_compras_inv, 0)) AS q_op_total,
    
    usuarios_vinc.q_usuarios,
    ie.cis_enviadas AS CI_envios_inv, 
    iv.cis_vistas AS CI_vistas_inv,
    
    -- ── No concretadas ──
    ofrec_inv.ult_noconc_inv, 
    ofrec_fae.ult_noconc_fae,
    
    CASE 
        WHEN DATE(ofrec_inv.ult_noconc_inv) < DATE(ofrec_fae.ult_noconc_fae) OR ofrec_inv.ult_noconc_inv IS NULL
        THEN DATE(ofrec_fae.ult_noconc_fae)
        ELSE DATE(ofrec_inv.ult_noconc_inv) 
    END AS ult_no_conc,
    
    ofertas.ult_oferta,
    
    -- ── Filtro AC / Representante ──
    CASE 
        WHEN ac.nombre IS NULL AND repre_vinc.representante IN ('Oficina Entre Rios', 'Oficina Rio 4to') 
        THEN repre_vinc.representante
        ELSE CONCAT(ac.nombre, ' ', ac.apellido)
    END AS filtro,
    
    -- ── Última operación ──
    DATE(GREATEST(
        COALESCE(DATE(aux_vend_inv.fecha_venta_inv), '0000-01-01'), 
        COALESCE(DATE(aux_vend_fae.fecha_venta_fae), '0000-01-01'), 
        COALESCE(
            CASE 
                WHEN aux_comp_inv.fecha_compra_inv IS NULL OR DATE(aux_comp_inv.fecha_compra_inv) < DATE(aux_comp_fae.fecha_compra_fae) 
                THEN DATE(aux_comp_fae.fecha_compra_fae) 
                ELSE DATE(aux_comp_inv.fecha_compra_inv) 
            END, '0000-01-01')
    )) AS Ult_op,
    
    -- ── Última actividad (incluye no concretadas y ofertas) ──
    DATE(GREATEST(
        COALESCE(DATE(aux_vend_inv.fecha_venta_inv), '0000-01-01'), 
        COALESCE(DATE(aux_vend_fae.fecha_venta_fae), '0000-01-01'),  
        COALESCE(ofrec_inv.ult_noconc_inv, '0000-01-01'), 
        COALESCE(ofrec_fae.ult_noconc_fae, '0000-01-01'), 
        COALESCE(ofertas.ult_oferta, '0000-01-01'), 
        COALESCE(
            CASE 
                WHEN aux_comp_inv.fecha_compra_inv IS NULL OR DATE(aux_comp_inv.fecha_compra_inv) < DATE(aux_comp_fae.fecha_compra_fae) 
                THEN DATE(aux_comp_fae.fecha_compra_fae) 
                ELSE DATE(aux_comp_inv.fecha_compra_inv) 
            END, '0000-01-01')
    )) AS Ult_act,
    
    -- ══════════════════════════════════════════════
    -- MÉTRICAS FINANCIERAS (de Q4)
    -- ══════════════════════════════════════════════
    IFNULL(
        CASE 
            WHEN consultaEnFecha.ValorEnFecha / vencimientos.SumaVencimientos > 1 THEN 0 
            ELSE 1 - consultaEnFecha.ValorEnFecha / vencimientos.SumaVencimientos 
        END, 0
    ) AS Porcentaje_EnFecha,
    
    IFNULL(
        CASE 
            WHEN consultaPropio.ValorPropio / vencimientos.SumaVencimientos > 1 THEN 0 
            ELSE 1 - consultaPropio.ValorPropio / vencimientos.SumaVencimientos 
        END, 0
    ) AS Porcentaje_Propio

FROM dcac.sociedades_tags st
INNER JOIN soc_ids ON st.id = soc_ids.id
LEFT JOIN dcac.provincias prov ON st.provincia = prov.provincia
LEFT JOIN dcac.usuarios ac ON st.asociado_comercial = ac.usuario
LEFT JOIN repre_vinc ON repre_vinc.id = st.id
LEFT JOIN aux_comp_fae ON st.id = aux_comp_fae.sociedad_compradora
LEFT JOIN aux_vend_fae ON st.id = aux_vend_fae.sociedad_vendedora
LEFT JOIN aux_comp_inv ON st.id = aux_comp_inv.sociedad_compradora
LEFT JOIN aux_vend_inv ON st.id = aux_vend_inv.sociedad_vendedora
LEFT JOIN concrecion_gral ON st.id = concrecion_gral.id_soc
LEFT JOIN concrecion_ult_5 ON st.id = concrecion_ult_5.id_soc
LEFT JOIN cis_fae ON st.id = cis_fae.sociedad
LEFT JOIN cis_inv ON st.id = cis_inv.sociedad
LEFT JOIN ofrec_fae ON st.id = ofrec_fae.sociedad_vendedora
LEFT JOIN ofrec_inv ON st.id = ofrec_inv.sociedad_vendedora
LEFT JOIN usuarios_vinc ON st.id = usuarios_vinc.id
LEFT JOIN ult_ingreso ON st.id = ult_ingreso.sociedad
LEFT JOIN info_compra ic ON st.id = ic.id_soc
LEFT JOIN info_envios ie ON st.id = ie.sociedad
LEFT JOIN info_vistas iv ON st.id = iv.sociedad
LEFT JOIN ofertas ON st.id = ofertas.sociedad
LEFT JOIN consultaEnFecha ON st.id = consultaEnFecha.Sociedad_ID
LEFT JOIN consultaPropio ON st.id = consultaPropio.Sociedad_ID
LEFT JOIN vencimientos ON st.id = vencimientos.Sociedad_ID

WHERE st.razon_social IS NOT NULL 
  AND st.razon_social != '' 
  AND st.estado = 0 
  AND LOWER(st.razon_social) NOT LIKE '%prueba%' 
  AND LOWER(st.razon_social) NOT LIKE '%baja%' 
  AND LOWER(st.razon_social) NOT LIKE '%eliminar%'
  AND (ac.nombre IS NOT NULL OR repre_vinc.representante IN ('Oficina Entre Rios', 'Oficina Rio 4to'))

GROUP BY st.id;
