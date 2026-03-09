-- =============================================================================
-- QUERY DETALLE DE LOTES — Faena + Invernada
-- =============================================================================
-- Filtro: poner 0 para ver TODOS, o un ID para filtrar por AC/Representante
-- Solo trae datos desde el 1 de enero de 2023
-- =============================================================================

WITH

-- ─────────────────────────────────────────────────
-- PARÁMETRO DE FILTRO (definido 1 sola vez para evitar error JDBC)
-- Poner 0 = todos los registros | ID numérico = filtra ese AC/Representante
-- ─────────────────────────────────────────────────
filtro_param AS (
    SELECT {{filtro_usuario}} AS user_id
),

FechaFaenaReal AS (
    SELECT lo_negocio, lo_fecha_faena_real
    FROM negocios.liquidacion_oficial
    WHERE lo_tipo_liquid = "interna"
    ORDER BY 1 DESC
),

ESTADOS_Invernada AS (
    SELECT 
        RS.revisacion AS ID_Revisacion, 
        CASE
        WHEN RS.estado = '4' AND RS.estado_b = '6' AND DTC.fecha_carga_final != '0000-00-00' AND RS.no_concretado = '0' AND (
                (AR.fecha_pago_real_1 = '0000-00-00' AND DATEDIFF(DATE(DTC.fecha_carga_final) + INTERVAL DTC.plazo_c1 DAY, CURRENT_DATE) < 0)
                OR ((AR.fecha_pago_real_1 != '0000-00-00' AND DTC.plazo_c2 > 0) AND (DATE(AR.fecha_pago_real_2) = '0000-00-00' AND DATEDIFF(DATE(DTC.fecha_carga_final) + INTERVAL DTC.plazo_c2 DAY, CURRENT_DATE) < 0)) 
                OR ((AR.fecha_pago_real_2 != '0000-00-00' AND DTC.plazo_c3 > 0) AND (DATE(AR.fecha_pago_real_3) = '0000-00-00' AND DATEDIFF(DATE(DTC.fecha_carga_final) + INTERVAL DTC.plazo_c3 DAY, CURRENT_DATE) < 0))
                OR ((AR.fecha_pago_real_3 != '0000-00-00' AND DTC.plazo_c4 > 0) AND (DATE(AR.fecha_pago_real_4) = '0000-00-00' AND DATEDIFF(DATE(DTC.fecha_carga_final) + INTERVAL DTC.plazo_c4 DAY, CURRENT_DATE) < 0))
                OR ((AR.fecha_pago_real_4 != '0000-00-00' AND DTC.plazo_c4 > 0) AND (DATE(AR.fecha_pago_real_4) = '0000-00-00' AND DATEDIFF(DATE(DTC.fecha_carga_final) + INTERVAL DTC.plazo_c4 DAY, CURRENT_DATE) < 0)) 
                )
        THEN "Pagos Vencidos"
        WHEN RS.estado = '4' AND RS.estado_b = '0' AND RS.no_concretado = '0' THEN "Tropas Vendidas"
        WHEN RS.estado = '4' AND RS.estado_b = '2' AND RS.no_concretado = '0' THEN "Tropas a Cargar"
        WHEN RS.estado = '4' AND RS.estado_b = '3' AND RS.no_concretado = '0' THEN "Tropas Cargadas"
        WHEN RS.estado = '4' AND RS.estado_b = '4' AND RS.no_concretado = '0' THEN "Tropas a Liquidar"
        WHEN RS.estado = '4' AND RS.estado_b = '5' AND RS.no_concretado = '0' THEN "Liquidadas"
        WHEN RS.estado = '4' AND RS.estado_b = '6' AND RS.no_concretado = '0' AND (
                (DATE(AR.fecha_pago_real_1) = '0000-00-00' AND DATEDIFF(DATE(DTC.fecha_carga_final) + INTERVAL DTC.plazo_c1 DAY, CURRENT_DATE) >= 0)
                OR ((DATE(AR.fecha_pago_real_1) != '0000-00-00' AND DTC.plazo_c2 > 0) AND (AR.fecha_pago_real_2 = '0000-00-00' AND DATEDIFF(DATE(DTC.fecha_carga_final) + INTERVAL DTC.plazo_c2 DAY, CURRENT_DATE) >= 0))
                OR ((DATE(AR.fecha_pago_real_2) != '0000-00-00' AND DTC.plazo_c3 > 0) AND (AR.fecha_pago_real_3 = '0000-00-00' AND DATEDIFF(DATE(DTC.fecha_carga_final) + INTERVAL DTC.plazo_c3 DAY, CURRENT_DATE) >= 0)) 
                OR ((DATE(AR.fecha_pago_real_3) != '0000-00-00' AND DTC.plazo_c4 > 0) AND (AR.fecha_pago_real_4 = '0000-00-00' AND DATEDIFF(DATE(DTC.fecha_carga_final) + INTERVAL DTC.plazo_c4 DAY, CURRENT_DATE) >= 0))
                OR ((DATE(AR.fecha_pago_real_4) != '0000-00-00' AND DTC.plazo_c4 > 0) AND (AR.fecha_pago_real_4 = '0000-00-00' AND DATEDIFF(DATE(DTC.fecha_carga_final) + INTERVAL DTC.plazo_c4 DAY, CURRENT_DATE) >= 0)) 
                )
            THEN "CERRADOS"
        WHEN RS.estado = '4' AND RS.estado_b = '6' AND RS.no_concretado = '0' AND (
                ((DTC.plazo_c1 != 0 AND DTC.plazo_c2 != 0 AND DTC.plazo_c3 != 0 AND DTC.plazo_c4 != 0) OR (DTC.plazo_c1 = 0 AND DTC.plazo_c2 != 0 AND DTC.plazo_c3 != 0 AND DTC.plazo_c4 != 0 AND DTC.plazo_c1_p > 0) AND DATE(AR.fecha_pago_real_1) != '0000-00-00' AND DATE(AR.fecha_pago_real_2) != '0000-00-00' AND DATE(AR.fecha_pago_real_3) != '0000-00-00' AND DATE(AR.fecha_pago_real_4) != '0000-00-00')
                OR ((DTC.plazo_c1 != 0 AND DTC.plazo_c2 != 0 AND DTC.plazo_c3 != 0) OR
                    (DTC.plazo_c1 = 0 AND DTC.plazo_c2 != 0 AND DTC.plazo_c3 != 0 AND DTC.plazo_c1_p > 0)
                    AND DATE(AR.fecha_pago_real_1) != '0000-00-00' AND DATE(AR.fecha_pago_real_2) != '0000-00-00' AND DATE(AR.fecha_pago_real_3) != '0000-00-00')
                OR  ((DTC.plazo_c1 != 0 AND DTC.plazo_c2 != 0) OR
                    (DTC.plazo_c1 = 0 AND DTC.plazo_c2 != 0 AND DTC.plazo_c1_p > 0)
                    AND DATE(AR.fecha_pago_real_1) != '0000-00-00' AND DATE(AR.fecha_pago_real_2) != '0000-00-00')
                OR  ((DTC.plazo_c1 = 0 AND DTC.plazo_c1_p > 0) 
                    AND DATE(AR.fecha_pago_real_1) != '0000-00-00')
                OR  ((DTC.plazo_c1 != 0) 
                    AND DATE(AR.fecha_pago_real_1) != '0000-00-00'))
                THEN "Negocios Terminados"
        END AS ESTADO_TROPAS 
        
    FROM dcac.revisaciones AS RS
    LEFT JOIN dcac.detalles_carga AS DTC ON RS.revisacion = DTC.revisacion
    LEFT JOIN dcac.analisis_resultados AS AR ON RS.revisacion = AR.revisacion
    WHERE RS.fecha_hora >= '2023-01-01 00:00:00'
    GROUP BY ID_Revisacion
), 

ESTADOS AS (
    SELECT n.id AS ID_Negocio,
    CASE 
    WHEN n.borrado != 1 AND n.no_concretado != 1 AND n.tipo = 3 AND n.directo = 1 THEN "TROPAS VENDIDAS"
    WHEN n.borrado != 1 AND n.no_concretado != 1 AND n.tipo = 9 AND n.directo = 1 THEN "TROPAS A CARGAR"
    WHEN n.borrado != 1 AND n.no_concretado != 1 AND n.tipo = 7 AND n.directo = 1 AND l.kg_carne = 0 THEN "TROPAS CARGADAS"
    WHEN n.borrado != 1 AND n.no_concretado != 1 AND n.tipo = 13 AND n.directo = 1 THEN "FAENADAS"
    WHEN n.borrado != 1 AND n.no_concretado != 1 AND n.tipo = 4 AND n.directo = 1 THEN "TROPAS A LIQUIDAR"
    WHEN n.borrado != 1 AND n.no_concretado != 1 AND n.tipo = 5 AND n.directo = 1 THEN "LIQUIDADAS"
    WHEN n.borrado != 1 AND n.no_concretado != 1 AND n.tipo = 8 AND n.directo = 1
        AND ( 
        ((DATE(lo.lo_fecha_faena_real) + INTERVAL (l.plazo2 + l.plazo_promedio) DAY) >= CURDATE())
        AND (DATE(lo.lo_fecha_faena_real) != '0000-00-00' AND lo.lo_fecha_faena_real IS NOT NULL)
        AND (DATE(lo.lo_fecha_pago_real) = '0000-00-00' OR lo.lo_fecha_pago_real IS NULL))
        THEN "CERRADOS"
    WHEN n.borrado != 1 AND n.no_concretado != 1 AND (
            ((lo.lo_fecha_faena_real + INTERVAL l.plazo2 + l.plazo_promedio DAY) < CURDATE())
            AND lo.lo_fecha_faena_real != '0000-00-00' AND lo.lo_fecha_faena_real IS NOT NULL)
        AND (((lo.lo_fecha_pago_real = '0000-00-00' OR lo.lo_fecha_pago_real IS NULL)) AND l.negocio > 7300) 
        AND n.tipo = 8 AND n.directo = 1
        THEN "PAGOS VENCIDOS"
    WHEN n.borrado != 1 AND n.no_concretado != 1 AND n.tipo = 8 AND n.directo = 1 
        AND lo.lo_fecha_pago_real != "0000-00-00" AND lo.lo_fecha_pago_real IS NOT NULL 
        THEN "NEGOCIOS TERMINADOS"
    ELSE NULL
    END AS ESTADO_TROPAS
    FROM negocios.liquidacion_oficial AS lo
    LEFT JOIN negocios.liquidaciones AS l ON lo.lo_negocio = l.negocio
    LEFT JOIN dcac.negocios AS n ON n.id = lo.lo_negocio
    WHERE 1 = 1
        AND n.fecha >= '2023-01-01 00:00:00'
        AND n.borrado != 1
        AND n.estado = 1
        AND n.directo = 1
        AND n.no_concretado != 1
        AND ((n.tipo >= 3 AND n.tipo <= 9) OR n.tipo = 13)
        AND lo.lo_tipo_liquid = "interna" 
    GROUP BY ID_Negocio
),

/* -------------- BASE INVERNADA -------------- */
invernada_base AS (
    SELECT 
        r.revisacion AS id_lote, 
        
        r.representante AS id_repre_vend,
        dcac.lotes_x_interesados.representante_de_compra AS id_repre_comp,
        r.asociado_comercial AS id_ac_vend,
        dcac.lotes_x_interesados.asociado_comercial_comprador AS id_ac_comp,

        CASE 
            WHEN r.estado IN ('5', '7') AND DATE(r.fecha_no_concretado) IS NOT NULL THEN DATE(r.fecha_no_concretado)
            WHEN (DATE(dcac.detalles_carga.fecha_carga_final) = "0000-00-00" OR dcac.detalles_carga.fecha_carga_final IS NULL) THEN DATE(dcac.detalles_carga.fecha_carga)
            ELSE DATE(dcac.detalles_carga.fecha_carga_final)
        END AS fecha_operacion,
         
        'Invernada' AS Tipo,

        CASE 
            WHEN dcac_informes_revisaciones.tipo_precio = "KILO" OR c.categoria IN (1, 2, 3, 4, 8, 9, 10, 27, 28, 29, 30, 31, 33, 34, 39) THEN  
                CASE WHEN dcac_informes_revisaciones.zona IN ('2') THEN 'Invernada Neo' ELSE 'Invernada' END
            ELSE 'Cria' 
        END AS UN,
          
        sv.razon_social AS RS_Vendedora,
        sc.razon_social AS RS_Compradora,

        CASE 
             WHEN dcac.detalles_carga.cantidad_animales IS NULL OR dcac.detalles_carga.cantidad_animales = "" THEN r.cantidad
             WHEN r.cantidad IS NULL THEN '0'
             ELSE dcac.detalles_carga.cantidad_animales
        END AS Cabezas,

        CONCAT(u_rv.nombre, ' ', u_rv.apellido) AS repre_vendedor,
        CONCAT(u_rc.nombre, ' ', u_rc.apellido) AS repre_comprador,
        CONCAT(acv.nombre, ' ', acv.apellido) AS AC_Vend,
        CONCAT(acc.nombre, ' ', acc.apellido) AS AC_Comp,
            
        CASE 
            WHEN COALESCE(CONCAT(acv.nombre, ' ', acv.apellido), CONCAT(u_rv.nombre, ' ', u_rv.apellido)) IN ('Valentin Torriglia','Santiago Julian','David Menghi','Alexis Deambrocio','Facundo Sansot','Sebastian Rivarola','Facundo Alonso','Sebastian Saparrat','Emiliano Sanchez','Hugo Ganis','Juan José Loza','Manuel Pons','Alejo Broggi','Nicolas Echezarreta','Sebastian Poullion','Lucila Frutos','Lucia Sposito','Marcelo Barboza','Alan Garcia','Jose Olmedo','Agustin Acuna','Pablo Cieri','Ignacio Diehl') THEN 'Regional'
            WHEN COALESCE(CONCAT(acv.nombre, ' ', acv.apellido), CONCAT(u_rv.nombre, ' ', u_rv.apellido)) <> '' OR (CONCAT(u_rv.nombre, ' ', u_rv.apellido) IS NOT NULL AND CONCAT(u_rv.nombre, ' ', u_rv.apellido) <> '') THEN
                CASE
                    WHEN CONCAT(u_rv.nombre, ' ', u_rv.apellido) IN ('Hugo Ganis', 'Jose Olmedo', 'Sebastian Saparrat') THEN 'Regional'
                    WHEN CONCAT(u_rv.nombre, ' ', u_rv.apellido) IN ('Hacienda Pedro Genta', 'Alberto Bernaudo', 'Pedro de Hagen', 'Maxi Oliveri') THEN 'Directo'
                    WHEN CONCAT(u_rv.nombre, ' ', u_rv.apellido) IN ('Oficina Rio 4to', 'Oficina Entre Rios','Oficina Bavio') THEN 'Directo'
                    WHEN CONCAT(u_rv.nombre, ' ', u_rv.apellido) IN ('Escritorio Enrique Gonzalez','Gonzalo Aduriz','Segundo Videla Dorna','Alejandro Bridger','Marcelo Schang','Alejandro Martin.','Alejandro Ballve','Rodolfo Aldasoro','Mario Vera','Francisco Echeverz','Nicolas Gurmindo','Mariano Laborde','Alberto Brosa','Esteban Enrique Avendaño','Marcelo Aguilar','Oscar Clos','Sebastian Rios','Marcelo Schafer','Bertolotto - Ríos Hacienda','Franco Barrionuevo','Agustin Irastorza','Mariano Rodriguez Alcobendas','Santiago Sitja','Martin Petricevich','Luis Maria de Hagen','Oficina Bs As Central') THEN 'Representante'
                    WHEN ar.bonificacion_vendedor < 0.01 AND ar.bonificacion_vendedor > -0.01 THEN 'Directo'
                    ELSE 'Comisionista'
                END
            ELSE 'Directo'
        END AS Canal_Venta,
        
        CASE 
            WHEN COALESCE(CONCAT(acc.nombre, ' ', acc.apellido), CONCAT(u_rc.nombre, ' ', u_rc.apellido)) IN ('Valentin Torriglia','Santiago Julian','David Menghi','Alexis Deambrocio','Facundo Sansot','Sebastian Rivarola','Facundo Alonso','Sebastian Saparrat','Emiliano Sanchez','Hugo Ganis','Juan José Loza','Manuel Pons','Alejo Broggi','Nicolas Echezarreta','Sebastian Poullion','Lucila Frutos','Lucia Sposito','Marcelo Barboza','Alan Garcia','Jose Olmedo','Agustin Acuna','Pablo Cieri','Ignacio Diehl') THEN 'Regional'
            WHEN COALESCE(CONCAT(acc.nombre, ' ', acc.apellido), CONCAT(u_rc.nombre, ' ', u_rc.apellido)) <> '' OR (CONCAT(u_rc.nombre, ' ', u_rc.apellido) IS NOT NULL AND CONCAT(u_rc.nombre, ' ', u_rc.apellido) <> '') THEN
                CASE
                    WHEN CONCAT(u_rc.nombre, ' ', u_rc.apellido) IN ('Hugo Ganis', 'Jose Olmedo', 'Sebastian Saparrat') THEN 'Regional'
                    WHEN CONCAT(u_rc.nombre, ' ', u_rc.apellido) IN ('Hacienda Pedro Genta', 'Alberto Bernaudo', 'Pedro de Hagen', 'Maxi Oliveri') THEN 'Directo'
                    WHEN CONCAT(u_rc.nombre, ' ', u_rc.apellido) IN ('Oficina Rio 4to', 'Oficina Entre Rios','Oficina Bavio') THEN 'Directo'
                    WHEN CONCAT(u_rc.nombre, ' ', u_rc.apellido) IN ('Escritorio Enrique Gonzalez','Gonzalo Aduriz','Segundo Videla Dorna','Alejandro Bridger','Marcelo Schang','Alejandro Martin.','Alejandro Ballve','Rodolfo Aldasoro','Mario Vera','Francisco Echeverz','Nicolas Gurmindo','Mariano Laborde','Alberto Brosa','Esteban Enrique Avendaño','Marcelo Aguilar','Oscar Clos','Sebastian Rios','Marcelo Schafer','Bertolotto - Ríos Hacienda','Franco Barrionuevo','Agustin Irastorza','Mariano Rodriguez Alcobendas','Santiago Sitja','Martin Petricevich','Luis Maria de Hagen','Oficina Bs As Central') THEN 'Representante'
                    WHEN ar.bonificacion_comprador < 0.01 AND ar.bonificacion_comprador > -0.01 THEN 'Directo'
                    ELSE 'Comisionista'
                END
            ELSE 'Directo'
        END AS Canal_compra,

        sv.cuit AS cuit_vend,
        sc.cuit AS cuit_comp, 
        r.partido AS part_id_vend, 
        r.provincia AS prov_id,
        
        ar.importe_vendedor AS importe_vendedor, 
        ar.importe_comprador AS importe_comprador, 
        CASE 
            WHEN ESTADOS_Invernada.ESTADO_TROPAS = 'Negocios Terminados' THEN ar.resultado_real_total
            ELSE ar.resultado_final 
        END AS resultado_final,

        CASE 
            WHEN c.nombre = 'Terneros' THEN 'TM'
            WHEN c.nombre = 'Terneras' THEN 'TH'
            WHEN c.nombre = 'Terneros y Terneras' THEN 'TM - TH'
            WHEN c.nombre = 'Novillitos' THEN 'NT'
            WHEN c.nombre = 'Vaquillonas' THEN 'VQ'
            WHEN c.nombre = 'Novillitos y Vaquillonas' THEN 'NT - VQ'
            WHEN c.nombre = 'Novillos' THEN 'NV'
            WHEN c.nombre = 'Vacas de Invernada' THEN 'VCI'
            WHEN c.nombre = 'Vacas Preñadas' THEN 'VCP'
            WHEN c.nombre = 'Vaquillonas para madre' THEN 'VQM'
            WHEN c.nombre = 'Vaquillonas preñadas' THEN 'VQP'
            WHEN c.nombre = 'Toros' THEN 'TR'
            WHEN c.nombre = 'Vaca manufactura' THEN 'VcM'
            WHEN c.nombre = 'Vaca Gorda' THEN 'VcG'
            WHEN c.nombre = 'Vacas y Vaquillonas' THEN 'V - VQ'
            WHEN c.nombre = 'Novillos y Vaquillonas' THEN 'NV - VQ'
            WHEN c.nombre = 'Vacas con criatura' THEN 'VCC'
            WHEN c.nombre = 'Toro Conserva' THEN 'TrC'
            WHEN c.nombre = 'Vaca Conserva' THEN 'VcC'
            WHEN c.nombre = 'MEJ' THEN 'MEJ'
            WHEN c.nombre = 'MEJ y Terneros' THEN 'MyT'
            WHEN c.nombre = 'Toros y Vacas' THEN 'Tr - Vc'
            ELSE c.nombre 
        END AS Cat,
        dcac.detalles_carga.peso_neto AS Kgs,
        dcac.detalles_carga.precio_venta2 AS precio_vend,
        dcac.detalles_carga.precio_compra AS precio_comp,
        dcac.detalles_carga.plazo_v1 AS plazo_vend,
        dcac.detalles_carga.plazo_c1 AS plazo_comp,
        ar.bonificacion_vendedor AS bonif_vend,
        ar.bonificacion_comprador AS bonif_comp,
        CONCAT(part.descripcion, ', ', prov.abreviatura) AS part_prov,
        
        UPPER(CONCAT(LEFT(TRIM(op.nombre), 1), LEFT(TRIM(op.apellido), 1))) AS operador,
        
        '' AS destino,
        
        CASE 
            WHEN r.estado = '0' THEN 'OFRECIMIENTOS'
            WHEN r.estado IN ('3', '6', '11', '12') THEN 'PUBLICADO'
            WHEN r.estado = '4' THEN 'CONCRETADA'
            WHEN r.estado = '5' THEN 'BAJA'
            WHEN r.estado = '6' THEN 'OCULTO'
            WHEN r.estado = '7' THEN 'NO CONCRETADAS'
        END AS estado_general,
        
        ESTADOS_Invernada.ESTADO_TROPAS AS estado_tropas,

        CASE 
            WHEN nc.motivo = 1 THEN 'Vendio por otro lado'
            WHEN nc.motivo = 2 THEN 'No la comercializo'
            WHEN nc.motivo = 3 THEN 'La cerro y se borro'
            WHEN nc.motivo = 4 THEN 'No contesto'
            WHEN nc.motivo = 5 THEN 'La dio de baja solo'
            ELSE '-'
        END AS Motivo_NC,
        
        CASE WHEN r.estado = '4' AND (r.estado_b = '6' OR r.estado_b = '5' OR r.estado_b = '4') AND r.no_concretado = '0' THEN 1 ELSE 0 END AS Cierre,
        
        CASE 
            WHEN ESTADOS_Invernada.ESTADO_TROPAS = 'CERRADOS' THEN
                CASE
                    WHEN (DATE(ar.fecha_pago_real_1) = '0000-00-00' OR ar.fecha_pago_real_1 IS NULL) AND DATEDIFF(DATE(dcac.detalles_carga.fecha_carga_final) + INTERVAL dcac.detalles_carga.plazo_c1 DAY, CURDATE()) BETWEEN 0 AND 7 THEN 1
                    WHEN DATE(ar.fecha_pago_real_1) != '0000-00-00' AND (DATE(ar.fecha_pago_real_2) = '0000-00-00' OR ar.fecha_pago_real_2 IS NULL) AND DATEDIFF(DATE(dcac.detalles_carga.fecha_carga_final) + INTERVAL dcac.detalles_carga.plazo_c2 DAY, CURDATE()) BETWEEN 0 AND 7 THEN 1
                    WHEN DATE(ar.fecha_pago_real_2) != '0000-00-00' AND (DATE(ar.fecha_pago_real_3) = '0000-00-00' OR ar.fecha_pago_real_3 IS NULL) AND DATEDIFF(DATE(dcac.detalles_carga.fecha_carga_final) + INTERVAL dcac.detalles_carga.plazo_c3 DAY, CURDATE()) BETWEEN 0 AND 7 THEN 1
                    WHEN DATE(ar.fecha_pago_real_3) != '0000-00-00' AND (DATE(ar.fecha_pago_real_4) = '0000-00-00' OR ar.fecha_pago_real_4 IS NULL) AND DATEDIFF(DATE(dcac.detalles_carga.fecha_carga_final) + INTERVAL dcac.detalles_carga.plazo_c4 DAY, CURDATE()) BETWEEN 0 AND 7 THEN 1
                    ELSE 0
                END
            ELSE 0 
        END AS Pagos_por_vencer

    FROM dcac.revisaciones r 
    LEFT JOIN dcac.detalles_carga ON r.revisacion = dcac.detalles_carga.revisacion
    LEFT JOIN dcac.sociedades_tags sv ON r.sociedad_vendedora = sv.id
    LEFT JOIN dcac.lotes_x_interesados ON r.revisacion = dcac.lotes_x_interesados.revisacion
    LEFT JOIN dcac.sociedades_tags sc ON dcac.lotes_x_interesados.sociedad_compradora = sc.id
    LEFT JOIN dcac.analisis_resultados ar ON r.revisacion = ar.revisacion
    LEFT JOIN dcac.analisis_resultados_proyectado arp ON r.revisacion = arp.revisacion
    LEFT JOIN dcac.usuarios acv ON r.asociado_comercial = acv.usuario
    LEFT JOIN dcac.usuarios acc ON dcac.lotes_x_interesados.asociado_comercial_comprador = acc.usuario
    LEFT JOIN dcac.usuarios u_rv ON r.representante = u_rv.usuario 
    LEFT JOIN dcac.usuarios u_rc ON dcac.lotes_x_interesados.representante_de_compra = u_rc.usuario
    LEFT JOIN ESTADOS_Invernada ON r.revisacion = ESTADOS_Invernada.ID_Revisacion
    LEFT JOIN negocios.cd_cotizaciones ON r.revisacion = lote_nro
    LEFT JOIN dcac_informes_revisaciones ON r.revisacion = dcac_informes_revisaciones.revisacion
    LEFT JOIN dcac.categorias c ON r.categoria = c.categoria
    LEFT JOIN dcac.usuarios uc ON uc.usuario = r.comprado_por 
    LEFT JOIN dcac.informes_baja nc ON r.revisacion = nc.revisacion 
    LEFT JOIN dcac.partidos part ON r.partido = part.partido
    LEFT JOIN dcac.provincias prov ON r.provincia = prov.provincia
    LEFT JOIN dcac.usuarios op ON r.adm_solicitud = op.usuario

    WHERE r.fecha_hora >= '2023-01-01 00:00:00'
      AND (
          (SELECT user_id FROM filtro_param) = 0
          OR r.representante = (SELECT user_id FROM filtro_param)
          OR dcac.lotes_x_interesados.representante_de_compra = (SELECT user_id FROM filtro_param)
          OR r.asociado_comercial = (SELECT user_id FROM filtro_param)
          OR dcac.lotes_x_interesados.asociado_comercial_comprador = (SELECT user_id FROM filtro_param)
      )

    GROUP BY 1
),

/* -------------- BASE FAENA -------------- */
faena_base AS (
    SELECT 
        n.id AS id_lote, 

        n.creado_rep AS id_repre_vend,
        NULL AS id_repre_comp, 
        n.asociado_comercial AS id_ac_vend,
        nl.asociado_comercial_comprador AS id_ac_comp,

        CASE
            WHEN n.directo = '1' AND n.no_concretado = '1' THEN DATE(n.fecha_no_concretado) 
            WHEN n.mag = 1 THEN DATE(n.fecha_vendida)
            WHEN FechaFaenaReal.lo_fecha_faena_real IS NULL OR DATE(FechaFaenaReal.lo_fecha_faena_real) = "0000-00-00" THEN DATE(nl.fecha_faena)
            ELSE DATE(FechaFaenaReal.lo_fecha_faena_real)
        END AS fecha_operacion,
        
        'Faena' AS Tipo,
        CASE WHEN (n.estado = 1 AND n.borrado != 1 AND n.directo = 0 AND n.no_concretado != 1 AND (n.tipo >= 0 AND n.tipo <= 9) AND n.mag = 1) THEN 'MAG' ELSE 'Faena' END AS UN,

        sv.razon_social AS RS_Vendedora,
        sc.razon_social AS RS_Compradora, 
        
        CASE
            WHEN lo.lo_total_cabezas > 0 THEN lo.lo_total_cabezas
            WHEN nl.cantidad_liquidada > 0 THEN nl.cantidad_liquidada
            WHEN n.cantidad > 0 THEN n.cantidad
            WHEN n.tipo_jaula = "1" THEN 35
            WHEN n.tipo_jaula = "2" THEN 50
        END AS Cabezas,

        CONCAT(rv.nombre, ' ', rv.apellido) AS repre_vendedor,
        NULL AS repre_comprador, 
        CONCAT(acv.nombre, ' ', acv.apellido) AS AC_Vend,
        CONCAT(acc.nombre, ' ', acc.apellido) AS AC_Comp,

        CASE 
            WHEN COALESCE(CONCAT(acv.nombre, ' ', acv.apellido), CONCAT(rv.nombre, ' ', rv.apellido)) IN ('Valentin Torriglia','Santiago Julian','David Menghi','Alexis Deambrocio','Facundo Sansot','Sebastian Rivarola','Facundo Alonso','Sebastian Saparrat','Emiliano Sanchez','Hugo Ganis','Juan José Loza','Manuel Pons','Alejo Broggi','Nicolas Echezarreta','Sebastian Poullion','Lucila Frutos','Lucia Sposito','Marcelo Barboza','Alan Garcia','Jose Olmedo','Agustin Acuna','Pablo Cieri','Ignacio Diehl') THEN 'Regional'
            WHEN COALESCE(CONCAT(acv.nombre, ' ', acv.apellido), CONCAT(rv.nombre, ' ', rv.apellido)) <> '' OR (CONCAT(rv.nombre, ' ', rv.apellido) IS NOT NULL AND CONCAT(rv.nombre, ' ', rv.apellido) <> '') THEN
                CASE
                    WHEN CONCAT(rv.nombre, ' ', rv.apellido) IN ('Hugo Ganis', 'Jose Olmedo', 'Sebastian Saparrat') THEN 'Regional'
                    WHEN CONCAT(rv.nombre, ' ', rv.apellido) IN ('Hacienda Pedro Genta', 'Alberto Bernaudo', 'Pedro de Hagen', 'Maxi Oliveri') THEN 'Directo'
                    WHEN CONCAT(rv.nombre, ' ', rv.apellido) IN ('Oficina Rio 4to', 'Oficina Entre Rios','Oficina Bavio') THEN 'Directo'
                    WHEN CONCAT(rv.nombre, ' ', rv.apellido) IN ('Escritorio Enrique Gonzalez','Gonzalo Aduriz','Segundo Videla Dorna','Alejandro Bridger','Marcelo Schang','Alejandro Martin.','Alejandro Ballve','Rodolfo Aldasoro','Mario Vera','Francisco Echeverz','Nicolas Gurmindo','Mariano Laborde','Alberto Brosa','Esteban Enrique Avendaño','Marcelo Aguilar','Oscar Clos','Sebastian Rios','Marcelo Schafer','Bertolotto - Ríos Hacienda','Franco Barrionuevo','Agustin Irastorza','Mariano Rodriguez Alcobendas','Santiago Sitja','Martin Petricevich','Luis Maria de Hagen','Oficina Bs As Central') THEN 'Representante'
                    WHEN ar.bonificacion_total < 0.01 AND ar.bonificacion_total > -0.01 THEN 'Directo'
                    ELSE 'Comisionista'
                END
            ELSE 'Directo'
        END AS Canal_Venta,
        
        CASE 
            WHEN CONCAT(acc.nombre, ' ', acc.apellido) IN ('Valentin Torriglia','Santiago Julian','David Menghi','Alexis Deambrocio','Facundo Sansot','Sebastian Rivarola','Facundo Alonso','Sebastian Saparrat','Emiliano Sanchez','Hugo Ganis','Juan José Loza','Manuel Pons','Alejo Broggi','Nicolas Echezarreta','Sebastian Poullion','Lucila Frutos','Lucia Sposito','Marcelo Barboza','Alan Garcia','Jose Olmedo','Agustin Acuna','Pablo Cieri','Ignacio Diehl') THEN 'Regional'
            WHEN CONCAT(acc.nombre, ' ', acc.apellido) <> '' AND CONCAT(acc.nombre, ' ', acc.apellido) IS NOT NULL THEN 'Comisionista'
            ELSE 'Directo'
        END AS Canal_compra,
                
        sv.cuit AS cuit_vend,
        sc.cuit AS cuit_comp, 
        n.partido AS part_id_vend, 
        n.provincia AS prov_id,
        
        ar.importe_comprador AS importe_vendedor, 
        ar.importe_vendedor AS importe_comprador, 
        CASE 
            WHEN ESTADOS.ESTADO_TROPAS = 'NEGOCIOS TERMINADOS' THEN ar.resultado_real_total
            WHEN ESTADOS.ESTADO_TROPAS = 'TROPAS VENDIDAS' OR ESTADOS.ESTADO_TROPAS = 'TROPAS A CARGAR' THEN arp.resultado_proyectado
            ELSE ar.resultado_final 
        END AS resultado_final,

        CASE 
            WHEN cat.nombre = 'Terneros' THEN 'TM'
            WHEN cat.nombre = 'Terneras' THEN 'TH'
            WHEN cat.nombre = 'Terneros y Terneras' THEN 'TM - TH'
            WHEN cat.nombre = 'Novillitos' THEN 'NT'
            WHEN cat.nombre = 'Vaquillonas' THEN 'VQ'
            WHEN cat.nombre = 'Novillitos y Vaquillonas' THEN 'NT - VQ'
            WHEN cat.nombre = 'Novillos' THEN 'NV'
            WHEN cat.nombre = 'Vacas de Invernada' THEN 'VCI'
            WHEN cat.nombre = 'Vacas Preñadas' THEN 'VCP'
            WHEN cat.nombre = 'Vaquillonas para madre' THEN 'VQM'
            WHEN cat.nombre = 'Vaquillonas preñadas' THEN 'VQP'
            WHEN cat.nombre = 'Toros' THEN 'TR'
            WHEN cat.nombre = 'Vaca manufactura' THEN 'VcM'
            WHEN cat.nombre = 'Vaca Gorda' THEN 'VcG'
            WHEN cat.nombre = 'Vacas y Vaquillonas' THEN 'V - VQ'
            WHEN cat.nombre = 'Novillos y Vaquillonas' THEN 'NV - VQ'
            WHEN cat.nombre = 'Vacas con criatura' THEN 'VCC'
            WHEN cat.nombre = 'Toro Conserva' THEN 'TrC'
            WHEN cat.nombre = 'Vaca Conserva' THEN 'VcC'
            WHEN cat.nombre = 'MEJ' THEN 'MEJ'
            WHEN cat.nombre = 'MEJ y Terneros' THEN 'MyT'
            WHEN cat.nombre = 'Toros y Vacas' THEN 'Tr - Vc'
            ELSE cat.nombre 
        END AS Cat,
        nl.kg_salida_neto AS Kgs,
        nl.precio1 AS precio_vend,
        nl.precio2 AS precio_comp,
        nl.plazo1 AS plazo_vend,
        nl.plazo2 AS plazo_comp,
        ar.bonificacion_total AS bonif_vend,
        0 AS bonif_comp,
        CONCAT(part.descripcion, ', ', prov.abreviatura) AS part_prov,
        
        UPPER(CONCAT(LEFT(TRIM(op.nombre), 1), LEFT(TRIM(op.apellido), 1))) AS operador,
        
        CASE 
            WHEN n.destino = 1 THEN "Consumo"
            WHEN n.destino = 0 THEN "No especificado"
            WHEN n.destino = 2 THEN "Hilton"
            WHEN n.destino = 3 THEN "UE"
            WHEN n.destino = 4 THEN "481"
            ELSE "" 
        END AS destino,

        CASE 
            WHEN n.tipo = '0' AND n.estado = '0' AND n.borrado != '1' AND n.no_concretado != '1' THEN 'OFRECIMIENTOS'
            WHEN n.tipo IN ('0', '10', '11', '12') AND n.borrado != '1' AND n.estado = '1' AND n.no_concretado != '1' THEN 'PUBLICADO'
            WHEN n.tipo IN ('3','4','5','7','8','9','13') AND n.borrado != '1' AND n.no_concretado != '1' THEN 'CONCRETADA'
            WHEN n.directo = '1' AND n.no_concretado = '1' AND n.borrado != '1' THEN 'NO CONCRETADAS'
            WHEN n.directo = '1' AND n.borrado = '1' AND n.no_concretado = '0' THEN 'BAJA'
        END AS estado_general,
        
        ESTADOS.ESTADO_TROPAS AS estado_tropas,

        CASE 
            WHEN nc.motivo = 1 THEN 'Vendio por otro lado'
            WHEN nc.motivo = 2 THEN 'No la comercializo'
            WHEN nc.motivo = 3 THEN 'La cerro y se borro'
            WHEN nc.motivo = 4 THEN 'No contesto'
            WHEN nc.motivo = 5 THEN 'La dio de baja solo'
            ELSE '-'
        END AS Motivo_NC,
        
        CASE WHEN n.tipo = '8' AND n.no_concretado != '1' AND n.borrado != '1' THEN 1 ELSE 0 END AS Cierre,
        
        CASE 
            WHEN ESTADOS.ESTADO_TROPAS = 'CERRADOS' 
                 AND DATEDIFF((DATE(lo.lo_fecha_faena_real) + INTERVAL (nl.plazo2 + nl.plazo_promedio) DAY), CURDATE()) BETWEEN 0 AND 7
            THEN 1 
            ELSE 0 
        END AS Pagos_por_vencer

    FROM dcac.negocios n
    LEFT JOIN ESTADOS ON n.id = ESTADOS.ID_Negocio
    LEFT JOIN negocios.liquidaciones nl ON n.id = nl.negocio
    LEFT JOIN dcac.sociedades_tags sv ON n.sociedad_vendedora = sv.id
    LEFT JOIN dcac.sociedades_tags sc ON nl.sociedad_compradora = sc.id
    LEFT JOIN dcac.categorias cat ON n.categoria = cat.categoria
    LEFT JOIN dcac.analisis_resultados ar ON n.id = ar.negocio
    LEFT JOIN dcac.analisis_resultados_proyectado arp ON n.id = arp.negocio
    LEFT JOIN dcac.usuarios acv ON n.asociado_comercial = acv.usuario
    LEFT JOIN dcac.usuarios acc ON nl.asociado_comercial_comprador = acc.usuario
    LEFT JOIN dcac.usuarios rv ON n.creado_rep = rv.usuario
    LEFT JOIN negocios.liquidacion_oficial lo ON n.id = lo.lo_negocio
    LEFT JOIN FechaFaenaReal ON FechaFaenaReal.lo_negocio = n.id
    LEFT JOIN negocios.cd_cotizaciones ON n.id = lote_nro
    LEFT JOIN dcac.usuarios uc ON uc.usuario = n.comprado_por
    LEFT JOIN dcac.informes_baja nc ON n.id = nc.negocio 
    LEFT JOIN negocios.compra_inmediata_faena ci ON n.id = ci.negocio AND ci.comprada = 1
    LEFT JOIN dcac.usuarios us_o ON n.generado_por = us_o.usuario AND us_o.perfil = 3 
    LEFT JOIN negocios.cd_logs_estado cdl ON negocios.cd_cotizaciones.id = cdl.cd_cotizacion_id AND cdl.estado = 1
    LEFT JOIN dcac.usuarios us_c ON cdl.usuario = us_c.usuario
    LEFT JOIN dcac.partidos part ON n.partido = part.partido
    LEFT JOIN dcac.provincias prov ON n.provincia = prov.provincia
    LEFT JOIN dcac.usuarios op ON n.operador = op.usuario

    WHERE n.fecha >= '2023-01-01 00:00:00'
      AND (
          (SELECT user_id FROM filtro_param) = 0
          OR n.creado_rep = (SELECT user_id FROM filtro_param)
          OR n.asociado_comercial = (SELECT user_id FROM filtro_param)
          OR nl.asociado_comercial_comprador = (SELECT user_id FROM filtro_param)
      )

    GROUP BY 1
)

/* -------------- SELECT FINAL UNIFICADO -------------- */
SELECT 
    id_lote,
    fecha_operacion,
    CONCAT(YEAR(fecha_operacion), LPAD(MONTH(fecha_operacion), 2, '0')) AS Fecha_op,
    MONTH(fecha_operacion) AS mes_operacion,
    Tipo,
    UN,
    RS_Vendedora,
    RS_Compradora,
    Cat,
    Cabezas,
    Kgs,
    precio_vend,
    precio_comp,
    plazo_vend,
    plazo_comp,
    bonif_vend,
    bonif_comp,
    repre_vendedor,
    repre_comprador,
    AC_Vend,
    AC_Comp,
    operador,
    Canal_Venta,
    Canal_compra,
    cuit_vend,
    cuit_comp,
    part_id_vend,
    prov_id,
    part_prov,
    destino,
    YEAR(fecha_operacion) AS YEAR_OP,
    QUARTER(fecha_operacion) AS Quarter_Op,
    importe_vendedor,
    importe_comprador,
    resultado_final,
    estado_general,
    estado_tropas,
    Motivo_NC,
    Cierre,
    Pagos_por_vencer,

    CASE 
        WHEN TRIM(COALESCE(AC_Vend, '')) <> '' OR repre_vendedor LIKE '%Oficina%' 
        THEN (resultado_final * 2.0 / 3.0)
        ELSE 0 
    END AS resultado_regional_vendedor,

    CASE 
        WHEN TRIM(COALESCE(AC_Comp, '')) <> '' OR repre_comprador LIKE '%Oficina%' 
        THEN (resultado_final * 1.0 / 3.0)
        ELSE 0 
    END AS resultado_regional_comprador

FROM (
    SELECT * FROM faena_base
    UNION ALL
    SELECT * FROM invernada_base
) AS consolidado

ORDER BY 3 DESC;
