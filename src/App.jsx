import React, { useState, useMemo, useEffect } from 'react'
import './styles/index.css'

const LOCAL_DATA_URL = '/gastos_reales.csv';
const KMS_DATA_URL = '/base_historica.csv';
const TAB_FLOTA_HIDDEN = false; // Flag to enable/disable the new tab if needed

const CATEGORY_COLORS = {
    'Combustible': '#3b82f6',
    'Otros': '#8b5cf6',
    'Obra Social': '#10b981',
    'Service / Reparaciones Auto': '#f59e0b',
    'Comidas': '#ec4899',
    'Peajes': '#64748b',
    'Hoteleria': '#06b6d4',
    'Servicios': '#14b8a6',
    'Monotributo/Autonomos': '#f97316',
    'Alimentos': '#84cc16',
    'Impuestos': '#ef4444',
    'Reparaciones': '#eab308'
};

const Icons = {
    Chart: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></svg>
    ),
    Money: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
    ),
    Audit: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" /></svg>
    ),
    Users: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
    ),
    Alert: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
    ),
    Fuel: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 22L17 22" /><path d="M4 22L4 4C4 2.89543 4.89543 2 6 2L15 2C16.1046 2 17 2.89543 17 4L17 22" /><path d="M7 2L7 9" /><path d="M14 2L14 9" /><path d="M17 8L19 8C20.1046 8 21 8.89543 21 10L21 22" /><line x1="7" y1="16" x2="14" y2="16" /><line x1="7" y1="12" x2="14" y2="12" /></svg>
    ),
    Car: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-1.1 0-2 .9-2 2v7c0 .6.4 1 1 1h2" /><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" /><path d="M13 17h2" /><path d="M7 17h6" /></svg>
    ),
    Close: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
    ),
    CreditCard: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
    ),
    Trophy: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 22V18" /><path d="M14 22V18" /><path d="M18 4H6v11a6 6 0 0 0 12 0V4z" /></svg>
    ),
    ChevronDown: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
    ),
    ChevronUp: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
    )
};

const Logo = () => (
    <div className="logo-wrapper">
        <div className="logo-icon-container">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="logo-svg">
                <path d="M3 3v18h18" />
                <path d="M18 17V9" />
                <path d="M13 17V5" />
                <path d="M8 17v-3" />
            </svg>
        </div>
        <div className="logo-text">
            <span className="logo-title">DECAMPOACAMPO</span>
            <span className="logo-subtitle">Analytics Pro</span>
        </div>
    </div>
);

// Parser robusto para CSV con comillas
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

// Parser de importe que maneja diferentes formatos (Especialmente el de Mendel con . para miles)
function parseImporte(str) {
    if (!str) return 0;
    // Limpiar el string: quitar comillas, espacios, símbolos de moneda
    let clean = str.replace(/"/g, '').replace(/\$/g, '').trim();

    // Si tiene coma y punto, asumimos formato europeo/arg (1.234,56)
    if (clean.includes(',') && clean.includes('.')) {
        if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
            // 1.234,56 -> 1234.56
            clean = clean.replace(/\./g, '').replace(',', '.');
        } else {
            // 1,234.56 -> 1234.56
            clean = clean.replace(/,/g, '');
        }
    } else if (clean.includes(',') && !clean.includes('.')) {
        // Solo coma: podría ser decimal (123,45) o miles (1,234)
        const parts = clean.split(',');
        if (parts.length === 2 && parts[1].length === 2) {
            clean = clean.replace(',', '.'); // Decimals
        } else {
            clean = clean.replace(/,/g, ''); // Thousands
        }
    } else if (clean.includes('.') && !clean.includes(',')) {
        // CASO CRÍTICO MENDEL: "37.465" suele ser 37465, no 37.465
        // Si hay un punto y exactamente 3 dígitos después, es muy probable que sea miles
        const parts = clean.split('.');
        if (parts.length > 1 && parts[parts.length - 1].length === 3) {
            clean = clean.replace(/\./g, '');
        }
    }

    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
}

// Parsea números que pueden tener separadores de miles y decimales
function parseNumber(str) {
    if (str === undefined || str === null) return 0;
    let clean = String(str).replace(/"/g, '').trim();
    if (!clean) return 0;

    if (clean.includes(',') && clean.includes('.')) {
        if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
            clean = clean.replace(/\./g, '').replace(',', '.');
        } else {
            clean = clean.replace(/,/g, '');
        }
    } else if (clean.includes(',') && !clean.includes('.')) {
        const parts = clean.split(',');
        if (parts.length === 2 && parts[1].length === 3) {
            clean = clean.replace(/,/g, '');
        } else if (parts.length === 2) {
            clean = clean.replace(',', '.');
        } else {
            clean = clean.replace(/,/g, '');
        }
    } else if (clean.includes('.') && !clean.includes(',')) {
        const parts = clean.split('.');
        if (parts.length > 1 && parts[parts.length - 1].length === 3) {
            clean = clean.replace(/\./g, '');
        }
    }

    const num = parseFloat(clean.replace(/[^0-9\.\-]/g, ''));
    return isNaN(num) ? 0 : num;
}

// Extraer periodo YYYYMM de una fecha
function extractPeriodo(fechaStr) {
    if (!fechaStr) return '';

    // Limpiar el string
    const fecha = fechaStr.trim().replace(/"/g, '');

    // Intentar diferentes formatos de fecha
    let match;

    // Formato DD/MM/YYYY o D/M/YYYY
    match = fecha.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
        const mes = match[2].padStart(2, '0');
        const anio = match[3];
        return `${anio}${mes}`;
    }

    // Formato YYYY-MM-DD
    match = fecha.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
        return `${match[1]}${match[2]}`;
    }

    // Formato DD-MM-YYYY
    match = fecha.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
    if (match) {
        const mes = match[2].padStart(2, '0');
        const anio = match[3];
        return `${anio}${mes}`;
    }

    return '';
}

// Normalizar texto para matching (quita tildes, deja minúsculas y colapsa espacios)
function normalizeStr(s) {
    if (!s && s !== '') return '';
    try {
        return String(s)
            .trim()
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .replace(/\s+/g, ' ')
            .toLowerCase();
    } catch (e) {
        // Fallback para entornos que no soporten \p{Diacritic}
        return String(s).trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toLowerCase();
    }
}

const formatCompact = (num) => {
    if (num >= 1000000) return '$' + (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return '$' + (num / 1000).toFixed(0) + 'k';
    return '$' + num.toFixed(0);
};

const Chart = ({ data, maxVal }) => (
    <div className="bar-chart mini">
        {data.map((d) => (
            <div key={d.periodo} className="bar-column">
                <div
                    className="bar-container"
                    style={{ height: `${(d.total / maxVal) * 100}%` }}
                >
                    {Object.entries(d.categorias).sort((a, b) => b[1] - a[1]).map(([cat, val]) => (
                        <div
                            key={cat}
                            className="bar-segment"
                            style={{
                                height: `${(val / d.total) * 100}%`,
                                background: CATEGORY_COLORS[cat] || '#6366f1'
                            }}
                            title={`${cat}`}
                        />
                    ))}
                </div>
                <span className="bar-label">{d.label}</span>
                <span className="bar-value short">{formatCompact(d.total)}</span>
            </div>
        ))}
    </div>
);

function App() {
    const [rawData, setRawData] = useState([])
    const [kmsData, setKmsData] = useState([]) // [NEW] Estado para KMs
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('tablero')
    const [busqueda, setBusqueda] = useState('')
    const [personaSeleccionada, setPersonaSeleccionada] = useState('')
    const [mesSeleccionado, setMesSeleccionado] = useState('')
    const [rangoMeses, setRangoMeses] = useState(6)
    const [mostrarTodasCategorias, setMostrarTodasCategorias] = useState(false)
    const [expandedAlertId, setExpandedAlertId] = useState(null); // ID del usuario expandido en alertas
    const [modoFecha, setModoFecha] = useState('mes'); // 'mes' o 'anio'
    const [categoriaFiltrada, setCategoriaFiltrada] = useState(''); // [NEW] Filtro global por categoría
    const [filtroTipoVehiculo, setFiltroTipoVehiculo] = useState(''); // '' | 'propio' | 'dcac'
    const [mostrarSoloConCombustible, setMostrarSoloConCombustible] = useState(false);

    // Estados para modales de KPIs
    const [modalKpiActivo, setModalKpiActivo] = useState(null); // 'cv' | 'top20' | 'distribucion' | null

    // Filtros de auditoría
    const [filtroFechaDesde, setFiltroFechaDesde] = useState('')
    const [filtroFechaHasta, setFiltroFechaHasta] = useState('')
    const [filtroMetodoPago, setFiltroMetodoPago] = useState('')
    const [filtroCategoria, setFiltroCategoria] = useState('')

    const formatCurrency = (val) => new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 0
    }).format(val);

    const formatPeriodo = (p) => {
        if (!p || p.length !== 6) return p;
        const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const mes = parseInt(p.slice(4), 10) - 1;
        return `${meses[mes]} ${p.slice(0, 4)}`;
    };

    const formatPeriodoCorto = (p) => {
        if (!p || p.length !== 6) return p;
        const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const mes = parseInt(p.slice(4), 10) - 1;
        return meses[mes];
    };

    useEffect(() => {
        fetch(LOCAL_DATA_URL)
            .then(res => res.text())
            .then(csv => {
                const lines = csv.split(/\r?\n/);
                const dataLines = lines.slice(1).filter(line => line.trim());

                const parsed = dataLines.map((line, index) => {
                    const cols = parseCSVLine(line);

                    // NUEVO MAPEO: BASE MENDEL (Verificado)
                    // 1: Fecha transaccion, 3: Usuario, 4: Comercio, 5: Importe, 12: Metodo, 15: Estado, 53: Categoria, 54: Periodo

                    const fechaStr = cols[1] || '';
                    const usuario = (cols[3] || '').trim();
                    const usuarioNorm = normalizeStr(usuario);
                    const comercio = (cols[4] || '').trim();
                    const importeStr = cols[5] || '';
                    const categoria = (cols[53] || 'Otros').trim(); // Columna BB (BB = index 53)
                    const metodo = (cols[12] || '').trim();
                    const estado = (cols[15] || '').trim().toUpperCase();

                    const importe = parseImporte(importeStr);
                    // El periodo ya viene normalizado en la columna 54 (ej: "202601")
                    const periodo = (cols[54] || '').replace(/-/g, '').trim();

                    return {
                        id: index,
                        fecha: fechaStr,
                        usuario: usuario || 'Sin Usuario',
                        usuarioNorm,
                        comercio: comercio,
                        importe: importe,
                        metodo: metodo,
                        estado: estado,
                        categoria: categoria || 'Otros',
                        periodo: periodo
                    };
                })
                    .filter(r => r.estado === 'CONFIRMADA' && r.usuario && r.periodo);



                const periodos = [...new Set(parsed.map(r => r.periodo))].sort().reverse();
                if (periodos.length > 0 && !mesSeleccionado) {
                    setMesSeleccionado(periodos[0]);
                }

                setRawData(parsed);

                // Cargar KMs después de los gastos
                fetch(KMS_DATA_URL)
                    .then(res => res.ok ? res.text() : '')
                    .then(csv => {
                        if (!csv) return;
                        const lines = csv.split(/\r?\n/).slice(1).filter(l => l.trim());
                        const parsedKms = lines.map(line => {
                            const cols = parseCSVLine(line);
                            // 0: AÑO, 1: MES, 2: MAIL, 3: COMERCIAL, 4: PATENTE, 5: TIPO, 6: KMS_EMPRESA, 7: KMS_TOTAL, 10: VEHICULO, 11: AMORTIZACION, 12: USUARIO_NORMALIZADO
                            const anio = cols[0];
                            const mesNum = cols[1];
                            const mail = (cols[2] || '').trim();
                            const comercial = cols[3];
                            const patente = cols[4];
                            const tipo = cols[5];
                            const kmsEmpresa = parseNumber(cols[6]) || 0;
                            const kmsTotales = parseNumber(cols[7]) || 0;
                            const vehiculoInfo = cols[10] || '-';
                            const amortizacion = parseNumber(cols[11]) || 0;
                            const usuarioNormalizado = (cols[12] || comercial || mail || '').trim();
                            const usuarioNormalizadoNorm = normalizeStr(usuarioNormalizado);

                            // Normalizar periodo a YYYYMM
                            const periodo = anio && mesNum ? `${anio}${mesNum.padStart(2, '0')}` : '';

                            return {
                                mail,
                                periodo,
                                comercial,
                                patente,
                                tipo,
                                kmsEmpresa,
                                kmsTotales,
                                vehiculoInfo,
                                amortizacion,
                                usuarioNormalizado,
                                usuarioNormalizadoNorm
                            };
                        });
                        console.log('KMs cargados:', parsedKms.length);
                        setKmsData(parsedKms);
                    })
                    .catch(e => console.error('Error loading KMs', e));

                setLoading(false);
            })
            .catch(err => {
                console.error('Error:', err);
                setLoading(false);
            });
    }, []);

    // Períodos disponibles
    const periodosDisponibles = useMemo(() => {
        return [...new Set(rawData.map(r => r.periodo))].sort().reverse();
    }, [rawData]);

    // Últimos N períodos para el gráfico (RELATIVO AL MES SELECCIONADO)
    const periodosGrafico = useMemo(() => {
        if (!mesSeleccionado) return [];
        const index = periodosDisponibles.indexOf(mesSeleccionado);
        if (index === -1) return [];

        // Tomamos desde el mes seleccionado hacia atrás (la lista está ordenada desc: más reciente primero)
        // Ejemplo: Si selecciono Ene 2026 (index 0), quiero [Ene 2026, Dic 2025, ...]
        return periodosDisponibles.slice(index, index + rangoMeses).reverse();
    }, [periodosDisponibles, rangoMeses, mesSeleccionado]);

    // Lista de usuarios únicos
    const usuariosUnicos = useMemo(() => {
        return [...new Set(rawData.map(r => r.usuario))].sort();
    }, [rawData]);

    // Métodos de pago únicos
    const metodosPago = useMemo(() => {
        return [...new Set(rawData.map(r => r.metodo))].filter(m => m).sort();
    }, [rawData]);

    // Categorías únicas
    const categoriasUnicas = useMemo(() => {
        return [...new Set(rawData.map(r => r.categoria))].sort();
    }, [rawData]);

    // Datos del mes seleccionado (con filtro de persona si está activo)
    const dataDelMes = useMemo(() => {
        let data = rawData.filter(r => r.periodo === mesSeleccionado);
        if (personaSeleccionada) {
            data = data.filter(r => r.usuario === personaSeleccionada);
        }
        if (categoriaFiltrada) {
            data = data.filter(r => r.categoria === categoriaFiltrada);
        }
        return data;
    }, [rawData, mesSeleccionado, personaSeleccionada, categoriaFiltrada]);

    // Total del mes
    const totalMes = dataDelMes.reduce((acc, r) => acc + r.importe, 0);

    // Kms del mes (usando kmsEmpresa de base_historica)
    const totalKmsMes = useMemo(() => {
        let kmsDelPeriodo = kmsData.filter(k => k.periodo === mesSeleccionado);
        if (personaSeleccionada) {
            // Usar matching por clave normalizada comparando con personaSeleccionada
            const personaKey = normalizeStr(personaSeleccionada || '');
            const userKms = kmsDelPeriodo.filter(k => {
                const kMail = normalizeStr(k.mail || '');
                const kComercial = normalizeStr(k.comercial || '');
                const kUserNorm = k.usuarioNormalizadoNorm || normalizeStr(k.usuarioNormalizado || '');
                return kUserNorm === personaKey || kComercial === personaKey || kMail === personaKey;
            });
            return userKms.reduce((acc, k) => acc + k.kmsEmpresa, 0);
        }
        return kmsDelPeriodo.reduce((acc, k) => acc + k.kmsEmpresa, 0);
    }, [kmsData, mesSeleccionado, personaSeleccionada]);

    const costoPorKm = totalKmsMes > 0 ? totalMes / totalKmsMes : 0;

    // Mapa de gasto de combustible por usuario (clave normalizada)
    const gastosCombustibleMap = useMemo(() => {
        return rawData.filter(r => r.categoria === 'Combustible').reduce((acc, r) => {
            const key = r.usuarioNorm || normalizeStr(r.usuario || '');
            acc[key] = (acc[key] || 0) + r.importe;
            return acc;
        }, {});
    }, [rawData]);

    // KMs filtrados según los filtros de flota (tipo de vehículo y solo con combustible)
    const kmsFiltrados = useMemo(() => {
        return kmsData.filter(k => {
            if (k.periodo !== mesSeleccionado) return false;
            if (filtroTipoVehiculo && k.tipo !== filtroTipoVehiculo) return false;
            if (mostrarSoloConCombustible) {
                const key = k.usuarioNormalizadoNorm || normalizeStr((k.usuarioNormalizado || k.comercial || k.mail) || '');
                return (gastosCombustibleMap[key] || 0) > 0;
            }
            return true;
        });
    }, [kmsData, mesSeleccionado, filtroTipoVehiculo, mostrarSoloConCombustible, gastosCombustibleMap]);

    // Composición por categoría
    const composicion = useMemo(() => {
        const counts = dataDelMes.reduce((acc, r) => {
            acc[r.categoria] = (acc[r.categoria] || 0) + r.importe;
            return acc;
        }, {});
        return Object.entries(counts).sort((a, b) => b[1] - a[1]);
    }, [dataDelMes]);

    // Datos para el gráfico de barras (evolución por mes)
    const datosGrafico = useMemo(() => {
        return periodosGrafico.map(periodo => {
            let dataDelPeriodo = rawData.filter(r => r.periodo === periodo);
            if (personaSeleccionada) {
                dataDelPeriodo = dataDelPeriodo.filter(r => r.usuario === personaSeleccionada);
            }

            if (categoriaFiltrada) {
                dataDelPeriodo = dataDelPeriodo.filter(r => r.categoria === categoriaFiltrada);
            }

            const porCategoria = dataDelPeriodo.reduce((acc, r) => {
                acc[r.categoria] = (acc[r.categoria] || 0) + r.importe;
                return acc;
            }, {});

            const total = dataDelPeriodo.reduce((acc, r) => acc + r.importe, 0);

            return {
                periodo,
                total,
                categorias: porCategoria
            };
        });
    }, [rawData, periodosGrafico, personaSeleccionada, categoriaFiltrada]);

    // Máximo para escalar el gráfico (añadimos un 15% de margen para que no toque el título)
    const maxGrafico = Math.max(...datosGrafico.map(d => d.total), 1) * 1.15;

    // Ranking de usuarios del mes
    const rankingUsuarios = useMemo(() => {
        const porUsuario = dataDelMes.reduce((acc, r) => {
            acc[r.usuario] = (acc[r.usuario] || 0) + r.importe;
            return acc;
        }, {});
        return Object.entries(porUsuario)
            .map(([nombre, total]) => ({ nombre, total }))
            .sort((a, b) => b.total - a.total);
    }, [dataDelMes]);

    // Transacciones del mes ordenadas por monto
    const transaccionesOrdenadas = useMemo(() => {
        return [...dataDelMes].sort((a, b) => b.importe - a.importe);
    }, [dataDelMes]);

    // ============ ALERTAS - Cálculo de desvíos ============
    const alertasDesvio = useMemo(() => {
        if (rawData.length === 0 || !mesSeleccionado) return [];

        const anio = mesSeleccionado.slice(0, 4);
        const mesLimite = mesSeleccionado; // e.g. "202512"

        // Filtrar datos según el modo
        const dataPeriodo = modoFecha === 'anio'
            ? rawData.filter(r => r.periodo.startsWith(anio) && r.periodo <= mesLimite)
            : rawData.filter(r => r.periodo === mesSeleccionado);

        // Cuántos meses estamos promediando
        const numMeses = modoFecha === 'anio' ? parseInt(mesLimite.slice(4), 10) : 1;

        const usuariosEnPeriodo = [...new Set(dataPeriodo.map(r => r.usuario))];
        const totalGlobal = dataPeriodo.reduce((acc, r) => acc + r.importe, 0);

        // Promedio MENSUAL por usuario del segmento
        const promedioMensualGlobal = usuariosEnPeriodo.length > 0
            ? totalGlobal / usuariosEnPeriodo.length / numMeses
            : 0;

        // Gasto total acumulado por usuario en el periodo
        const totalPorUsuario = dataPeriodo.reduce((acc, r) => {
            acc[r.usuario] = (acc[r.usuario] || 0) + r.importe;
            return acc;
        }, {});

        return Object.entries(totalPorUsuario)
            .map(([usuario, totalAcumulado]) => {
                const promedioMensualUsuario = totalAcumulado / numMeses;
                const desvioMonto = promedioMensualUsuario - promedioMensualGlobal;
                const desvioPct = promedioMensualGlobal > 0 ? (desvioMonto / promedioMensualGlobal) * 100 : 0;

                return {
                    usuario,
                    // En modo anio mostramos el promedio mensual que lleva, en modo mes el gasto del mes
                    gastoActual: promedioMensualUsuario,
                    promedio: promedioMensualGlobal,
                    desvioMonto,
                    desvioPct,
                    totalAcumulado, // Info extra
                    esAnual: modoFecha === 'anio'
                };
            })
            .filter(d => d.desvioMonto > 0)
            .sort((a, b) => b.desvioMonto - a.desvioMonto);
    }, [rawData, mesSeleccionado, modoFecha]);

    // ============ KPIs AVANZADOS - Análisis de Desvíos ============
    const kpisDesvios = useMemo(() => {
        if (rawData.length === 0 || !mesSeleccionado) return null;

        const anio = mesSeleccionado.slice(0, 4);
        const mesLimite = mesSeleccionado;
        
        // Filtrar datos según el modo
        const dataPeriodo = modoFecha === 'anio'
            ? rawData.filter(r => r.periodo.startsWith(anio) && r.periodo <= mesLimite)
            : rawData.filter(r => r.periodo === mesSeleccionado);

        if (dataPeriodo.length === 0) return null;

        // ========== 1. Coeficiente de Variación por Categoría ==========
        const gastosPorCategoria = {};
        dataPeriodo.forEach(r => {
            if (!gastosPorCategoria[r.categoria]) gastosPorCategoria[r.categoria] = {};
            if (!gastosPorCategoria[r.categoria][r.usuario]) gastosPorCategoria[r.categoria][r.usuario] = 0;
            gastosPorCategoria[r.categoria][r.usuario] += r.importe;
        });

        const coefVariacion = Object.entries(gastosPorCategoria).map(([cat, usuarios]) => {
            const entries = Object.entries(usuarios);
            const valores = entries.map(([, v]) => v);
            if (valores.length < 2) return { categoria: cat, cv: 0, media: valores[0] || 0, n: valores.length, detalle: [] };
            
            const media = valores.reduce((a, b) => a + b, 0) / valores.length;
            const varianza = valores.reduce((acc, v) => acc + Math.pow(v - media, 2), 0) / valores.length;
            const desvStd = Math.sqrt(varianza);
            const cv = media > 0 ? (desvStd / media) * 100 : 0;
            
            // Detalle de usuarios ordenados por gasto (para el modal)
            const detalle = entries
                .map(([usuario, gasto]) => ({ usuario, gasto, desvio: gasto - media, desvioPct: ((gasto - media) / media) * 100 }))
                .sort((a, b) => b.gasto - a.gasto);
            
            return { categoria: cat, cv: Math.round(cv), media, desvStd, n: valores.length, detalle };
        }).sort((a, b) => b.cv - a.cv);

        // ========== 2. Top 20% Gastadores vs Promedio ==========
        const totalPorUsuario = {};
        dataPeriodo.forEach(r => {
            totalPorUsuario[r.usuario] = (totalPorUsuario[r.usuario] || 0) + r.importe;
        });
        
        const usuariosOrdenados = Object.entries(totalPorUsuario)
            .map(([usuario, total]) => ({ usuario, total }))
            .sort((a, b) => b.total - a.total);
        
        const cantidadTop20 = Math.max(1, Math.ceil(usuariosOrdenados.length * 0.2));
        const top20Lista = usuariosOrdenados.slice(0, cantidadTop20);
        
        const promedioGeneral = usuariosOrdenados.reduce((acc, u) => acc + u.total, 0) / usuariosOrdenados.length;
        const promedioTop20 = top20Lista.reduce((acc, u) => acc + u.total, 0) / top20Lista.length;
        const ratioTop20 = promedioGeneral > 0 ? promedioTop20 / promedioGeneral : 0;

        // ========== 3. Distribución por Categoría (flags) ==========
        const distribucionEsperada = {
            'Hoteleria': { min: 30, max: 45, nombre: 'Hotel' },
            'Combustible': { min: 20, max: 35, nombre: 'Combustible' },
            'Comidas': { min: 15, max: 30, nombre: 'Comidas' },
            'Obra Social': { min: 5, max: 20, nombre: 'Obra Social' }
        };

        const flagsDistribucion = [];
        Object.entries(totalPorUsuario).forEach(([usuario, totalUsuarioVal]) => {
            const totalUsuario = typeof totalUsuarioVal === 'object' ? totalUsuarioVal.total : totalUsuarioVal;
            if (totalUsuario === 0) return;
            
            const gastosPorCat = {};
            dataPeriodo.filter(r => r.usuario === usuario).forEach(r => {
                gastosPorCat[r.categoria] = (gastosPorCat[r.categoria] || 0) + r.importe;
            });

            // Calcular distribución completa del usuario
            const distribucionUsuario = Object.entries(gastosPorCat).map(([cat, gasto]) => ({
                categoria: cat,
                gasto,
                porcentaje: Math.round((gasto / totalUsuario) * 100)
            })).sort((a, b) => b.porcentaje - a.porcentaje);

            Object.entries(gastosPorCat).forEach(([cat, gasto]) => {
                const pct = (gasto / totalUsuario) * 100;
                const esperado = distribucionEsperada[cat];
                if (esperado && pct > esperado.max) {
                    flagsDistribucion.push({
                        usuario,
                        categoria: esperado.nombre,
                        categoriaOriginal: cat,
                        porcentaje: Math.round(pct),
                        esperadoMin: esperado.min,
                        esperadoMax: esperado.max,
                        exceso: Math.round(pct - esperado.max),
                        totalUsuario,
                        gastoCategoria: gasto,
                        distribucionCompleta: distribucionUsuario
                    });
                }
            });
        });
        flagsDistribucion.sort((a, b) => b.exceso - a.exceso);

        // ========== 4. Crecimiento Mensual por Asociado ==========
        const periodos = [...new Set(rawData.map(r => r.periodo))].sort();
        const mesActualIdx = periodos.indexOf(mesSeleccionado);
        
        const crecimientoMensual = [];
        if (mesActualIdx >= 1) {
            const mesAnterior = periodos[mesActualIdx - 1];
            
            const gastoMesActual = {};
            const gastoMesAnterior = {};
            
            rawData.filter(r => r.periodo === mesSeleccionado).forEach(r => {
                gastoMesActual[r.usuario] = (gastoMesActual[r.usuario] || 0) + r.importe;
            });
            rawData.filter(r => r.periodo === mesAnterior).forEach(r => {
                gastoMesAnterior[r.usuario] = (gastoMesAnterior[r.usuario] || 0) + r.importe;
            });

            Object.entries(gastoMesActual).forEach(([usuario, actual]) => {
                const anterior = gastoMesAnterior[usuario];
                if (anterior && anterior > 0) {
                    const crecPct = ((actual - anterior) / anterior) * 100;
                    if (crecPct > 15) {
                        crecimientoMensual.push({
                            usuario,
                            anterior,
                            actual,
                            crecimiento: Math.round(crecPct)
                        });
                    }
                }
            });
            crecimientoMensual.sort((a, b) => b.crecimiento - a.crecimiento);
        }

        return {
            coefVariacion: coefVariacion.slice(0, 6), // Top 6 categorías
            coefVariacionCompleto: coefVariacion, // Todas las categorías para el modal
            top20: {
                promedio: promedioTop20,
                promedioGeneral,
                ratio: ratioTop20,
                cantidad: cantidadTop20,
                totalUsuarios: usuariosOrdenados.length,
                esProblema: ratioTop20 > 2,
                lista: top20Lista // Lista completa del top 20% para el modal
            },
            flagsDistribucion: flagsDistribucion.slice(0, 5), // Top 5 flags
            flagsDistribucionCompleto: flagsDistribucion, // Todos los flags para el modal
            distribucionEsperada, // Rangos esperados para mostrar en modal
            crecimientoMensual: crecimientoMensual.slice(0, 5) // Top 5 con crecimiento
        };
    }, [rawData, mesSeleccionado, modoFecha]);

    // ============ DASHBOARD - Análisis de Eficiencia de Combustible ============
    const eficienciaCombustible = useMemo(() => {
        if (!mesSeleccionado || rawData.length === 0) return [];

        // 1. Calcular Gasto de Combustible por Usuario este mes (clave normalizada)
        const gastosCombustible = {};
        const displayNameMap = {}; // map keyNorm -> display name (cuando exista)

        rawData
            .filter(r => r.periodo === mesSeleccionado && r.categoria === 'Combustible')
            .forEach(r => {
                const key = r.usuarioNorm || normalizeStr(r.usuario || '');
                gastosCombustible[key] = (gastosCombustible[key] || 0) + r.importe;
                if (!displayNameMap[key]) displayNameMap[key] = r.usuario;
            });

        // 2. Obtener Kms por Usuario este mes (del CSV nuevo) usando clave normalizada
        const kmsPorUsuario = {};
        const detallesAuto = {};

        kmsData
            .filter(k => k.periodo === mesSeleccionado)
            .forEach(k => {
                const rawKey = k.usuarioNormalizado || k.comercial || k.mail || '';
                const key = k.usuarioNormalizadoNorm || normalizeStr(rawKey);
                kmsPorUsuario[key] = (kmsPorUsuario[key] || 0) + k.kmsEmpresa;
                if (!detallesAuto[key]) {
                    detallesAuto[key] = { patente: k.patente, tipo: k.tipo, vehiculo: k.vehiculoInfo };
                }
            });

        // 3. Cruzar datos usando claves normalizadas
        const todosLosId = new Set([...Object.keys(gastosCombustible), ...Object.keys(kmsPorUsuario)]);

        return Array.from(todosLosId)
            .map(key => {
                const gasto = gastosCombustible[key] || 0;
                const kms = kmsPorUsuario[key] || 0;
                const detalle = detallesAuto[key] || { patente: '-', tipo: '-', vehiculo: '-' };
                const display = displayNameMap[key] || key;

                return {
                    usuario: display,
                    usuarioKey: key,
                    gasto,
                    kms,
                    eficiencia: kms > 0 ? gasto / kms : 0,
                    patente: detalle.patente,
                    tipo: detalle.tipo,
                    vehiculo: detalle.vehiculo
                };
            })
            .filter(d => d.gasto > 0 || d.kms > 0)
            .sort((a, b) => b.gasto - a.gasto);

    }, [rawData, kmsData, mesSeleccionado]);

    // Calcular datos del gráfico para un usuario específico (para la vista expandida)
    const getChartDataForUser = (usuario) => {
        const periodos = periodosGrafico; // Usa los mismos 6 meses (o los que estén configurados)
        return periodos.map(periodo => {
            const dataP = rawData.filter(r => r.periodo === periodo && r.usuario === usuario);
            const total = dataP.reduce((acc, r) => acc + r.importe, 0);
            const cats = dataP.reduce((acc, r) => {
                acc[r.categoria] = (acc[r.categoria] || 0) + r.importe;
                return acc;
            }, {});
            return {
                periodo,
                label: formatPeriodoCorto(periodo),
                total,
                categorias: cats
            };
        });
    };

    // ============ AUDITORÍA - Filtros avanzados ============
    const transaccionesFiltradas = useMemo(() => {
        let data = rawData;

        if (mesSeleccionado) {
            data = data.filter(r => r.periodo === mesSeleccionado);
        }

        if (personaSeleccionada || busqueda) {
            const filtro = personaSeleccionada || busqueda;
            data = data.filter(r =>
                r.usuario.toLowerCase().includes(filtro.toLowerCase())
            );
        }

        if (filtroMetodoPago) {
            data = data.filter(r => r.metodo === filtroMetodoPago);
        }

        if (filtroCategoria) {
            data = data.filter(r => r.categoria === filtroCategoria);
        }

        return data.sort((a, b) => b.importe - a.importe);
    }, [rawData, mesSeleccionado, personaSeleccionada, busqueda, filtroMetodoPago, filtroCategoria]);

    // Manejar selección de persona
    const handlePersonaClick = (nombre) => {
        if (personaSeleccionada === nombre) {
            setPersonaSeleccionada('');
            setBusqueda('');
        } else {
            setPersonaSeleccionada(nombre);
            setBusqueda(nombre);
        }
    };

    // Ir a auditoría con filtros aplicados
    const irAAuditoria = (usuario, periodo) => {
        setBusqueda(usuario);
        setMesSeleccionado(periodo);
        setActiveTab('auditoria');
    };

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="loading-spinner"></div>
                <h2>Cargando datos...</h2>
            </div>
        );
    }

    return (
        <div className="app-container">
            {/* Header */}
            <header className="app-header">
                <div className="header-left">
                    <Logo />
                </div>
                <nav className="header-nav">
                    <button
                        className={`nav-tab ${activeTab === 'tablero' ? 'active' : ''}`}
                        onClick={() => setActiveTab('tablero')}
                    >
                        <Icons.Chart /> Tablero
                    </button>
                    <button
                        className={`nav-tab ${activeTab === 'alertas' ? 'active' : ''}`}
                        onClick={() => setActiveTab('alertas')}
                    >
                        <Icons.Alert /> Desvíos
                    </button>
                    <button
                        className={`nav-tab ${activeTab === 'auditoria' ? 'active' : ''}`}
                        onClick={() => setActiveTab('auditoria')}
                    >
                        <Icons.Audit /> Auditoría
                    </button>
                    <button
                        className={`nav-tab ${activeTab === 'flota' ? 'active' : ''}`}
                        onClick={() => setActiveTab('flota')}
                    >
                        <Icons.Car /> Flota
                    </button>
                </nav>
            </header>

            <main className="main-content">
                {activeTab === 'tablero' && (
                    <div className="dashboard-grid">
                        {/* Columna izquierda */}
                        <div className="dashboard-left">
                            {/* Filtros */}
                            <div className="filters-row">
                                <div className="filter-group">
                                    <label>Período</label>
                                    <select value={mesSeleccionado} onChange={e => setMesSeleccionado(e.target.value)}>
                                        {periodosDisponibles.map(p => (
                                            <option key={p} value={p}>{formatPeriodo(p)}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="filter-group search-group">
                                    <label>Buscar persona</label>
                                    <input
                                        type="text"
                                        placeholder="Escribí un nombre..."
                                        value={busqueda}
                                        onChange={e => {
                                            setBusqueda(e.target.value);
                                            const match = usuariosUnicos.find(u =>
                                                u.toLowerCase() === e.target.value.toLowerCase()
                                            );
                                            setPersonaSeleccionada(match || '');
                                        }}
                                        list="usuarios-list"
                                    />
                                    <datalist id="usuarios-list">
                                        {usuariosUnicos.map(u => <option key={u} value={u} />)}
                                    </datalist>
                                </div>
                                {personaSeleccionada && (
                                    <button className="clear-filter" onClick={() => {
                                        setPersonaSeleccionada('');
                                        setBusqueda('');
                                    }}>
                                        <Icons.Close /> Persona
                                    </button>
                                )}
                                {categoriaFiltrada && (
                                    <button className="clear-filter" onClick={() => setCategoriaFiltrada('')}>
                                        <Icons.Close /> Categoría
                                    </button>
                                )}
                            </div>

                            {/* Gráfico de barras */}
                            <div className="chart-card">
                                <div className="chart-header">
                                    <h3>
                                        <Icons.Chart /> Evolución de Gastos
                                        {personaSeleccionada && <span className="filter-badge">{personaSeleccionada}</span>}
                                        {categoriaFiltrada && (
                                            <span
                                                className="filter-badge"
                                                style={{ background: CATEGORY_COLORS[categoriaFiltrada] || 'var(--accent-blue)' }}
                                            >
                                                {categoriaFiltrada}
                                            </span>
                                        )}
                                    </h3>
                                    <div className="range-selector">
                                        {[3, 6, 9, 12].map(n => (
                                            <button
                                                key={n}
                                                className={rangoMeses === n ? 'active' : ''}
                                                onClick={() => setRangoMeses(n)}
                                            >
                                                {n}M
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="bar-chart">
                                    {datosGrafico.map((d, i) => (
                                        <div key={d.periodo} className="bar-column">
                                            <div
                                                className="bar-container"
                                                style={{ height: `${(d.total / maxGrafico) * 100}%` }}
                                            >
                                                {Object.entries(d.categorias).sort((a, b) => b[1] - a[1]).map(([cat, val]) => (
                                                    <div
                                                        key={cat}
                                                        className="bar-segment"
                                                        style={{
                                                            height: `${(val / d.total) * 100}%`,
                                                            background: CATEGORY_COLORS[cat] || '#6366f1'
                                                        }}
                                                        title={`${cat}: ${formatCurrency(val)}`}
                                                    />
                                                ))}
                                            </div>
                                            <span className="bar-label">{formatPeriodoCorto(d.periodo)}</span>
                                            <span className="bar-value">{formatCurrency(d.total)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Indicadores */}
                            <div className="indicators-row">
                                <div className="indicator-card">
                                    <div className="indicator-icon-wrapper blue">
                                        <Icons.Money />
                                    </div>
                                    <div className="indicator-info">
                                        <span className="indicator-label">Total {formatPeriodo(mesSeleccionado)}</span>
                                        <span className="indicator-value">{formatCurrency(totalMes)}</span>
                                    </div>
                                </div>
                                <div className="indicator-card">
                                    <div className="indicator-icon-wrapper green">
                                        <Icons.Audit />
                                    </div>
                                    <div className="indicator-info">
                                        <span className="indicator-label">Transacciones</span>
                                        <span className="indicator-value">{dataDelMes.length}</span>
                                    </div>
                                </div>
                                <div className="indicator-card">
                                    <div className="indicator-icon-wrapper orange">
                                        <Icons.Users />
                                    </div>
                                    <div className="indicator-info">
                                        <span className="indicator-label">Usuarios</span>
                                        <span className="indicator-value">{rankingUsuarios.length}</span>
                                    </div>
                                </div>
                                <div className="indicator-card">
                                    <div className="indicator-icon-wrapper purple">
                                        <Icons.Fuel />
                                    </div>
                                    <div className="indicator-info">
                                        <span className="indicator-label">KMs Empresa</span>
                                        <span className="indicator-value">{totalKmsMes.toLocaleString('es-AR')} km</span>
                                    </div>
                                </div>
                                <div className="indicator-card">
                                    <div className="indicator-icon-wrapper red">
                                        <Icons.Money />
                                    </div>
                                    <div className="indicator-info">
                                        <span className="indicator-label">Costo / Km</span>
                                        <span className="indicator-value">{formatCurrency(costoPorKm)}</span>
                                    </div>
                                </div>
                            </div>


                            {/* Sección de Eficiencia de Combustible - VERSIÓN MEJORADA */}
                            {eficienciaCombustible.length > 0 && (
                                <div className="fuel-section">
                                    {/* Header con gradiente */}
                                    <div className="fuel-header">
                                        <div className="fuel-header-left">
                                            <div className="fuel-icon-wrapper">
                                                <Icons.Fuel />
                                            </div>
                                            <div>
                                                <h3>Eficiencia de Combustible</h3>
                                                <span className="fuel-header-subtitle">
                                                    Análisis de rendimiento por usuario
                                                </span>
                                            </div>
                                        </div>
                                        <div className="fuel-badge">
                                            {eficienciaCombustible.length} usuarios
                                        </div>
                                    </div>

                                    {/* Cards Grid */}
                                    <div className="fuel-content">
                                        <div className="fuel-cards-grid">
                                            {eficienciaCombustible.map((d, i) => {
                                                const isExpanded = expandedAlertId === d.usuario;
                                                const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'default';

                                                // Calcular porcentaje de eficiencia (para la barra visual)
                                                const maxEficiencia = Math.max(...eficienciaCombustible.filter(x => x.kms > 0).map(x => x.eficiencia), 1);
                                                const eficienciaPct = d.kms > 0 ? Math.min((d.eficiencia / maxEficiencia) * 100, 100) : 0;

                                                return (
                                                    <div
                                                        key={d.usuario}
                                                        className={`fuel-card ${isExpanded ? 'expanded' : ''}`}
                                                        onClick={() => setExpandedAlertId(isExpanded ? null : d.usuario)}
                                                    >
                                                        {/* Card Header */}
                                                        <div className="fuel-card-header">
                                                            <div className={`fuel-rank ${rankClass}`}>
                                                                {i + 1}
                                                            </div>
                                                            <div className="fuel-user-info">
                                                                <div className="fuel-user-name">{d.usuario}</div>
                                                                <div className="fuel-user-vehicle">
                                                                    <Icons.Car /> <span>{d.tipo !== '-' ? d.tipo : 'Sin especificar'}</span>
                                                                    {d.patente !== '-' && <span className="patente-tag">{d.patente}</span>}
                                                                </div>
                                                            </div>
                                                            <div className="fuel-expand-btn">
                                                                {isExpanded ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
                                                            </div>
                                                        </div>

                                                        {/* Card Body - Stats */}
                                                        <div className="fuel-card-body">
                                                            <div className="fuel-stats-row">
                                                                <div className="fuel-stat">
                                                                    <div className="fuel-stat-label">Gasto Total</div>
                                                                    <div className="fuel-stat-value highlight">
                                                                        {formatCurrency(d.gasto)}
                                                                    </div>
                                                                </div>
                                                                <div className="fuel-stat">
                                                                    <div className="fuel-stat-label">Kms Recorridos</div>
                                                                    <div className={`fuel-stat-value ${d.kms > 0 ? 'success' : ''}`}>
                                                                        {d.kms > 0 ? `${d.kms.toLocaleString()} km` : 'Sin datos'}
                                                                    </div>
                                                                </div>
                                                                <div className="fuel-stat">
                                                                    <div className="fuel-stat-label">Costo / Km</div>
                                                                    <div className={`fuel-stat-value ${d.kms > 0 ? 'warning' : ''}`}>
                                                                        {d.kms > 0 ? `${formatCurrency(d.eficiencia)}` : '-'}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Barra de eficiencia visual */}
                                                            {d.kms > 0 && (
                                                                <div className="fuel-efficiency-bar">
                                                                    <div className="efficiency-label">
                                                                        <span>Índice de costo relativo</span>
                                                                        <strong>{eficienciaPct.toFixed(0)}%</strong>
                                                                    </div>
                                                                    <div className="efficiency-track">
                                                                        <div
                                                                            className="efficiency-fill"
                                                                            style={{ width: `${eficienciaPct}%` }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Detalles expandidos */}
                                                        {isExpanded && (
                                                            <div className="fuel-card-details" onClick={e => e.stopPropagation()}>
                                                                <div className="fuel-detail-grid">
                                                                    <div className="fuel-detail-item">
                                                                        <span className="label">Tipo de Vehículo</span>
                                                                        <span className="value">{d.tipo !== '-' ? d.tipo : 'No especificado'}</span>
                                                                    </div>
                                                                    <div className="fuel-detail-item">
                                                                        <span className="label">Patente</span>
                                                                        <span className="value">{d.patente !== '-' ? d.patente : 'No registrada'}</span>
                                                                    </div>
                                                                    <div className="fuel-detail-item">
                                                                        <span className="label">Kms Declarados</span>
                                                                        <span className="value">{d.kms.toLocaleString()} km</span>
                                                                    </div>
                                                                    <div className="fuel-detail-item">
                                                                        <span className="label">Gasto Mensual</span>
                                                                        <span className="value">{formatCurrency(d.gasto)}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Columna derecha */}
                        <div className="dashboard-right">
                            {/* Composición */}
                            <div className="section-card">
                                <h3><Icons.Chart /> Composición por Categoría</h3>
                                <div className="composition-bar">
                                    {composicion.map(([cat, val]) => {
                                        const pct = ((val / totalMes) * 100).toFixed(1);
                                        return (
                                            <div
                                                key={cat}
                                                className={`composition-segment ${categoriaFiltrada === cat ? 'active' : ''}`}
                                                style={{
                                                    width: `${Math.max(pct, 1)}%`,
                                                    background: CATEGORY_COLORS[cat] || '#6366f1'
                                                }}
                                                title={`${cat}: ${pct}% (${formatCurrency(val)})`}
                                                onClick={() => setCategoriaFiltrada(categoriaFiltrada === cat ? '' : cat)}
                                            >
                                                <span className="segment-tooltip">{pct}%</span>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="category-list">
                                    {(mostrarTodasCategorias ? composicion : composicion.slice(0, 5)).map(([cat, val]) => (
                                        <div
                                            key={cat}
                                            className={`category-item clickable ${categoriaFiltrada === cat ? 'active' : ''}`}
                                            onClick={() => setCategoriaFiltrada(categoriaFiltrada === cat ? '' : cat)}
                                        >
                                            <div className="category-info">
                                                <span className="category-dot" style={{ background: CATEGORY_COLORS[cat] || '#6366f1' }} />
                                                <span>{cat}</span>
                                            </div>
                                            <span className="category-amount">{formatCurrency(val)}</span>
                                        </div>
                                    ))}
                                    {composicion.length > 5 && (
                                        <button
                                            className="show-more-btn"
                                            onClick={() => setMostrarTodasCategorias(!mostrarTodasCategorias)}
                                        >
                                            {mostrarTodasCategorias ? '▲ Mostrar menos' : `▼ Mostrar ${composicion.length - 5} más`}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Ranking o transacciones de persona */}
                            <div className="section-card">
                                <h3>{personaSeleccionada ? <><Icons.CreditCard /> Consumos de {personaSeleccionada}</> : <><Icons.Trophy /> Ranking de Gastos</>}</h3>
                                <div className="ranking-list">
                                    {personaSeleccionada ? (
                                        transaccionesOrdenadas.slice(0, 10).map((t, i) => (
                                            <div key={i} className="ranking-item">
                                                <div className="ranking-info">
                                                    <span className="ranking-name">{t.comercio || 'Sin comercio'}</span>
                                                    <span className="ranking-meta">{t.fecha} • {t.categoria}</span>
                                                </div>
                                                <span className="ranking-amount">{formatCurrency(t.importe)}</span>
                                            </div>
                                        ))
                                    ) : (
                                        rankingUsuarios.slice(0, 10).map((u, i) => (
                                            <div
                                                key={i}
                                                className="ranking-item clickable"
                                                onClick={() => handlePersonaClick(u.nombre)}
                                            >
                                                <div className="ranking-position">{i + 1}</div>
                                                <span className="ranking-name">{u.nombre}</span>
                                                <span className="ranking-amount">{formatCurrency(u.total)}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
                }

                {
                    activeTab === 'alertas' && (
                        <div className="alertas-container">
                            <div className="alertas-header-row">
                                <div className="header-titles">
                                    <h2><Icons.Alert /> {modoFecha === 'mes' ? 'Análisis de Desvíos' : 'Ranking Consolidado'}</h2>
                                    <p>{modoFecha === 'mes' ? 'Comparativa de gasto individual vs. promedio del segmento' : 'Gasto acumulado por usuario en el período seleccionado'}</p>
                                </div>
                                <div className="alertas-filters">
                                    <div className="toggle-mode">
                                        <button
                                            className={modoFecha === 'mes' ? 'active' : ''}
                                            onClick={() => setModoFecha('mes')}>Mes</button>
                                        <button
                                            className={modoFecha === 'anio' ? 'active' : ''}
                                            onClick={() => setModoFecha('anio')}>Año</button>
                                    </div>
                                    <select value={mesSeleccionado} onChange={e => setMesSeleccionado(e.target.value)}>
                                        {periodosDisponibles.map(p => (
                                            <option key={p} value={p}>{formatPeriodo(p)}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* ========== KPIs AVANZADOS ========== */}
                            {kpisDesvios && (
                                <div className="kpis-desvios-grid">
                                    {/* KPI 1: Coeficiente de Variación por Categoría */}
                                    <div className="kpi-card clickable" onClick={() => setModalKpiActivo('cv')}>
                                        <div className="kpi-header">
                                            <h4>📊 Coef. Variación por Categoría</h4>
                                            <span className="kpi-hint">CV = Desv.Std / Media × 100</span>
                                        </div>
                                        <div className="kpi-content cv-list">
                                            {kpisDesvios.coefVariacion.map(c => (
                                                <div key={c.categoria} className="cv-item">
                                                    <span className="cv-cat">{c.categoria}</span>
                                                    <div className="cv-bar-wrapper">
                                                        <div 
                                                            className={`cv-bar ${c.cv > 60 ? 'danger' : c.cv > 40 ? 'warning' : 'ok'}`}
                                                            style={{ width: `${Math.min(c.cv, 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className={`cv-value ${c.cv > 60 ? 'danger' : c.cv > 40 ? 'warning' : ''}`}>
                                                        {c.cv}%
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="kpi-legend">
                                            <span className="legend-item ok">●&lt;40% Estable</span>
                                            <span className="legend-item warning">●40-60% Variable</span>
                                            <span className="legend-item danger">●&gt;60% Investigar</span>
                                        </div>
                                        <div className="kpi-click-hint" title="Ver explicación y desglose">Click para ver detalle <span aria-hidden="true">→</span></div>
                                    </div>

                                    {/* KPI 2: Top 20% vs Promedio */}
                                    <div className="kpi-card clickable" onClick={() => setModalKpiActivo('top20')}>
                                        <div className="kpi-header">
                                            <h4>🏆 Top 20% Gastadores</h4>
                                            <span className="kpi-hint">Comparativa con promedio general</span>
                                        </div>
                                        <div className="kpi-content top20-content">
                                            <div className="top20-main">
                                                <div className={`top20-ratio ${kpisDesvios.top20.esProblema ? 'danger' : 'ok'}`}>
                                                    {kpisDesvios.top20.ratio.toFixed(2)}x
                                                </div>
                                                <span className="top20-label">vs promedio</span>
                                            </div>
                                            <div className="top20-details">
                                                <div className="top20-row">
                                                    <span>Top 20% ({kpisDesvios.top20.cantidad} personas)</span>
                                                    <strong>{formatCurrency(kpisDesvios.top20.promedio)}</strong>
                                                </div>
                                                <div className="top20-row">
                                                    <span>Promedio General</span>
                                                    <strong>{formatCurrency(kpisDesvios.top20.promedioGeneral)}</strong>
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`kpi-alert ${kpisDesvios.top20.esProblema ? 'show' : ''}`}>
                                            ⚠️ Ratio &gt;2x indica problema de control
                                        </div>
                                        <div className="kpi-click-hint" title="Ver explicación y desglose">Click para ver detalle <span aria-hidden="true">→</span></div>
                                    </div>

                                    {/* KPI 3: Flags de Distribución */}
                                    <div className="kpi-card clickable" onClick={() => setModalKpiActivo('distribucion')}>
                                        <div className="kpi-header">
                                            <h4>🚩 Distribución Anómala</h4>
                                            <span className="kpi-hint">% de categoría fuera de rango esperado</span>
                                        </div>
                                        <div className="kpi-content flags-list">
                                            {kpisDesvios.flagsDistribucion.length > 0 ? (
                                                kpisDesvios.flagsDistribucion.map((f, i) => (
                                                    <div key={i} className="flag-item">
                                                        <span className="flag-user">{f.usuario}</span>
                                                        <span className="flag-detail">
                                                            <strong>{f.porcentaje}%</strong> en {f.categoria}
                                                            <span className="flag-expected">(máx esperado: {f.esperadoMax}%)</span>
                                                        </span>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="no-flags">✓ Sin anomalías detectadas</div>
                                            )}
                                        </div>
                                        <div className="kpi-click-hint" title="Ver explicación y desglose">Click para ver detalle <span aria-hidden="true">→</span></div>
                                    </div>

                                    {/* KPI 4: Crecimiento Mensual */}
                                    <div className="kpi-card">
                                        <div className="kpi-header">
                                            <h4>📈 Crecimiento Mensual</h4>
                                            <span className="kpi-hint">Comparado con mes anterior (&gt;15%)</span>
                                        </div>
                                        <div className="kpi-content growth-list">
                                            {kpisDesvios.crecimientoMensual.length > 0 ? (
                                                kpisDesvios.crecimientoMensual.map((g, i) => (
                                                    <div key={i} className="growth-item">
                                                        <span className="growth-user">{g.usuario}</span>
                                                        <div className="growth-values">
                                                            <span className="growth-from">{formatCurrency(g.anterior)}</span>
                                                            <span className="growth-arrow">→</span>
                                                            <span className="growth-to">{formatCurrency(g.actual)}</span>
                                                            <span className={`growth-pct ${g.crecimiento > 30 ? 'danger' : 'warning'}`}>
                                                                +{g.crecimiento}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="no-growth">✓ Sin crecimientos sospechosos</div>
                                            )}
                                        </div>
                                        <div className="kpi-info-note">
                                            ℹ️ Se compara el gasto total del mes actual vs. el mes inmediatamente anterior
                                        </div>
                                    </div>
                                </div>
                            )}

                            <h3 className="section-subtitle">Personas con Desvío</h3>
                            <div className="alertas-list">
                                {alertasDesvio.map((a, i) => {
                                    const isExpanded = expandedAlertId === a.usuario;
                                    const userChartData = isExpanded ? getChartDataForUser(a.usuario) : [];
                                    const userMax = isExpanded ? Math.max(...userChartData.map(d => d.total), 1) * 1.15 : 0;

                                    return (
                                        <div
                                            key={a.usuario}
                                            className={`alerta-item ${isExpanded ? 'expanded' : ''}`}
                                            onClick={() => setExpandedAlertId(isExpanded ? null : a.usuario)}
                                        >
                                            <div className="alerta-summary">
                                                <div className="rank-col">#{i + 1}</div>
                                                <div className="name-col">
                                                    {a.usuario}
                                                    <button 
                                                        className="btn-auditoria-mini"
                                                        onClick={(e) => { e.stopPropagation(); irAAuditoria(a.usuario, mesSeleccionado); }}
                                                    >
                                                        <Icons.Audit /> Auditoría
                                                    </button>
                                                </div>

                                                <div className="stats-col">
                                                    <div className="stat-mini">
                                                        <span className="label">{modoFecha === 'mes' ? 'Actual' : 'Prom. Mensual'}</span>
                                                        <span className="value">{formatCurrency(a.gastoActual)}</span>
                                                    </div>
                                                    {modoFecha === 'mes' && (
                                                        <div className="stat-mini">
                                                            <span className="label">Desvío</span>
                                                            <span className={`badge ${a.desvioPct > 50 ? 'danger' : 'warning'}`}>
                                                                +{a.desvioPct.toFixed(0)}%
                                                            </span>
                                                        </div>
                                                    )}
                                                    {modoFecha === 'anio' && (
                                                        <div className="stat-mini">
                                                            <span className="label">Promedio/Mes</span>
                                                            <span className="value muted">{formatCurrency(a.promedio)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="expand-icon">{isExpanded ? <Icons.ChevronUp /> : <Icons.ChevronDown />}</div>
                                            </div>

                                            {isExpanded && (
                                                <div className="alerta-details" onClick={e => e.stopPropagation()}>
                                                    <div className="detail-chart-wrapper">
                                                        <h4>Evolución de Gastos (Últimos {rangoMeses} meses)</h4>
                                                        <Chart data={userChartData} maxVal={userMax} />
                                                    </div>
                                                    <div className="detail-info">
                                                        <h4>Datos Clave</h4>
                                                        <div className="detail-grid">
                                                            <div className="d-item">
                                                                <span>{modoFecha === 'mes' ? 'Promedio Mes' : 'Promedio Mensual Segmento'}</span>
                                                                <strong>{formatCurrency(a.promedio)}</strong>
                                                            </div>
                                                            <div className="d-item">
                                                                <span>Diferencia</span>
                                                                <strong className={a.desvioMonto > 0 ? 'text-red' : 'text-green'}>
                                                                    {a.desvioMonto > 0 ? '+' : ''}{formatCurrency(a.desvioMonto)}
                                                                </strong>
                                                            </div>
                                                        </div>
                                                        <div style={{fontSize: '0.85em', color: 'var(--text-muted)', marginTop: '0.7em', lineHeight: 1.4}}>
                                                            <span>Despliega para ver evolución y desglose de gastos. Haz click fuera para cerrar.</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {alertasDesvio.length === 0 && (
                                <div className="empty-state">
                                    <p>No hay alertas de desvío para mostrar</p>
                                </div>
                            )}

                            {/* ========== MODALES DE KPIs ========== */}
                            {modalKpiActivo && (
                                <div className="modal-overlay" onClick={() => setModalKpiActivo(null)}>
                                    <div className="modal-content kpi-modal" onClick={e => e.stopPropagation()}>
                                        <button className="modal-close" onClick={() => setModalKpiActivo(null)}>
                                            <Icons.Close />
                                        </button>

                                        {/* Modal: Coeficiente de Variación */}
                                        {modalKpiActivo === 'cv' && kpisDesvios && (
                                            <>
                                                <h2>📊 Coeficiente de Variación por Categoría</h2>
                                                <p className="modal-subtitle">
                                                    El CV mide qué tan dispersos están los gastos entre usuarios. 
                                                    Un CV alto significa que hay mucha diferencia entre lo que gasta cada persona.
                                                </p>
                                                
                                                <div className="modal-cv-grid">
                                                    {kpisDesvios.coefVariacionCompleto.map(cat => (
                                                        <div key={cat.categoria} className="modal-cv-category">
                                                            <div className="modal-cv-header">
                                                                <h4>{cat.categoria}</h4>
                                                                <span className={`modal-cv-badge ${cat.cv > 60 ? 'danger' : cat.cv > 40 ? 'warning' : 'ok'}`}>
                                                                    CV: {cat.cv}%
                                                                </span>
                                                            </div>
                                                            <div className="modal-cv-stats">
                                                                <span>Media: {formatCurrency(cat.media)}</span>
                                                                <span>Usuarios: {cat.n}</span>
                                                            </div>
                                                            <div className="modal-cv-interpretation">
                                                                {cat.cv > 60 ? (
                                                                    <span className="danger">⚠️ MUY variable - Investigar diferencias</span>
                                                                ) : cat.cv > 40 ? (
                                                                    <span className="warning">⚡ Moderado - Revisar outliers</span>
                                                                ) : (
                                                                    <span className="ok">✓ Estable - Gastos consistentes</span>
                                                                )}
                                                            </div>
                                                            {cat.detalle && cat.detalle.length > 0 && (
                                                                <div className="modal-cv-users">
                                                                    <strong>Top gastadores:</strong>
                                                                    {cat.detalle.slice(0, 5).map((u, i) => (
                                                                        <div key={i} className="modal-cv-user">
                                                                            <span>{u.usuario}</span>
                                                                            <span>{formatCurrency(u.gasto)}</span>
                                                                            <span className={u.desvioPct > 50 ? 'danger' : u.desvioPct > 20 ? 'warning' : ''}>
                                                                                {u.desvioPct > 0 ? '+' : ''}{u.desvioPct.toFixed(0)}% vs media
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}

                                        {/* Modal: Top 20% */}
                                        {modalKpiActivo === 'top20' && kpisDesvios && (
                                            <>
                                                <h2>🏆 Top 20% Gastadores vs Promedio</h2>
                                                <p className="modal-subtitle">
                                                    Comparamos el 20% que más gasta con el promedio general. 
                                                    Si el ratio es mayor a 2x, hay un problema de control de gastos.
                                                </p>
                                                
                                                <div className="modal-top20-summary">
                                                    <div className="modal-top20-big">
                                                        <span className={`ratio ${kpisDesvios.top20.esProblema ? 'danger' : 'ok'}`}>
                                                            {kpisDesvios.top20.ratio.toFixed(2)}x
                                                        </span>
                                                        <span className="label">Ratio Top 20% / Promedio</span>
                                                    </div>
                                                    <div className="modal-top20-comparison">
                                                        <div>
                                                            <strong>Promedio Top 20%</strong>
                                                            <span>{formatCurrency(kpisDesvios.top20.promedio)}</span>
                                                        </div>
                                                        <div>
                                                            <strong>Promedio General</strong>
                                                            <span>{formatCurrency(kpisDesvios.top20.promedioGeneral)}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <h4>Listado del Top 20% ({kpisDesvios.top20.cantidad} de {kpisDesvios.top20.totalUsuarios} personas)</h4>
                                                <div className="modal-top20-list">
                                                    {kpisDesvios.top20.lista.map((u, i) => (
                                                        <div key={i} className="modal-top20-item">
                                                            <span className="pos">#{i + 1}</span>
                                                            <span className="name">{u.usuario}</span>
                                                            <span className="amount">{formatCurrency(u.total)}</span>
                                                            <span className="vs-avg">
                                                                {((u.total / kpisDesvios.top20.promedioGeneral - 1) * 100).toFixed(0)}% vs promedio
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}

                                        {/* Modal: Distribución Anómala */}
                                        {modalKpiActivo === 'distribucion' && kpisDesvios && (
                                            <>
                                                <h2>🚩 Distribución Anómala de Gastos</h2>
                                                <p className="modal-subtitle">
                                                    Detectamos usuarios cuyo porcentaje de gasto en una categoría excede el rango esperado.
                                                </p>

                                                <div className="modal-dist-expected">
                                                    <h4>Rangos Esperados por Categoría</h4>
                                                    <div className="modal-dist-ranges">
                                                        {Object.entries(kpisDesvios.distribucionEsperada).map(([cat, rango]) => (
                                                            <div key={cat} className="range-item">
                                                                <span className="cat">{rango.nombre}</span>
                                                                <span className="range">{rango.min}% - {rango.max}%</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {kpisDesvios.flagsDistribucionCompleto.length > 0 ? (
                                                    <div className="modal-dist-flags">
                                                        <h4>Anomalías Detectadas ({kpisDesvios.flagsDistribucionCompleto.length})</h4>
                                                        {kpisDesvios.flagsDistribucionCompleto.map((f, i) => (
                                                            <div key={i} className="modal-dist-flag">
                                                                <div className="flag-header">
                                                                    <strong>{f.usuario}</strong>
                                                                    <span className="flag-alert">
                                                                        {f.porcentaje}% en {f.categoria} (máx: {f.esperadoMax}%)
                                                                    </span>
                                                                </div>
                                                                <div className="flag-distribution">
                                                                    {f.distribucionCompleta && f.distribucionCompleta.map((d, j) => (
                                                                        <div key={j} className="dist-bar-item">
                                                                            <span className="dist-cat">{d.categoria}</span>
                                                                            <div className="dist-bar-wrapper">
                                                                                <div 
                                                                                    className={`dist-bar ${d.categoria === f.categoriaOriginal ? 'highlight' : ''}`}
                                                                                    style={{ width: `${d.porcentaje}%` }}
                                                                                />
                                                                            </div>
                                                                            <span className="dist-pct">{d.porcentaje}%</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="modal-no-flags">
                                                        ✓ No se detectaron anomalías en la distribución de gastos
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                }

                {
                    activeTab === 'auditoria' && (
                        <div className="auditoria-container">
                            <div className="audit-filters">
                                <div className="filter-group">
                                    <label>Período</label>
                                    <select value={mesSeleccionado} onChange={e => setMesSeleccionado(e.target.value)}>
                                        <option value="">Todos</option>
                                        {periodosDisponibles.map(p => (
                                            <option key={p} value={p}>{formatPeriodo(p)}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="filter-group">
                                    <label>Persona</label>
                                    <input
                                        type="text"
                                        placeholder="Filtrar por persona..."
                                        value={busqueda}
                                        onChange={e => setBusqueda(e.target.value)}
                                        list="usuarios-audit"
                                    />
                                    <datalist id="usuarios-audit">
                                        {usuariosUnicos.map(u => <option key={u} value={u} />)}
                                    </datalist>
                                </div>
                                <div className="filter-group">
                                    <label>Método de Pago</label>
                                    <select value={filtroMetodoPago} onChange={e => setFiltroMetodoPago(e.target.value)}>
                                        <option value="">Todos</option>
                                        {metodosPago.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                                <div className="filter-group">
                                    <label>Categoría</label>
                                    <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
                                        <option value="">Todas</option>
                                        {categoriasUnicas.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="audit-summary">
                                <span>{transaccionesFiltradas.length} transacciones</span>
                                <span>Total: {formatCurrency(transaccionesFiltradas.reduce((a, r) => a + r.importe, 0))}</span>
                            </div>

                            <div className="audit-table-container">
                                <table className="audit-table">
                                    <thead>
                                        <tr>
                                            <th>Fecha</th>
                                            <th>Usuario</th>
                                            <th>Comercio</th>
                                            <th>Categoría</th>
                                            <th>Método</th>
                                            <th className="amount-col">Importe</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {transaccionesFiltradas.slice(0, 100).map((t, i) => (
                                            <tr key={i}>
                                                <td>{t.fecha}</td>
                                                <td>{t.usuario}</td>
                                                <td>{t.comercio || '-'}</td>
                                                <td>
                                                    <span className="cat-pill" style={{ background: CATEGORY_COLORS[t.categoria] || '#6366f1' }}>
                                                        {t.categoria}
                                                    </span>
                                                </td>
                                                <td>{t.metodo}</td>
                                                <td className="amount-col">{formatCurrency(t.importe)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )
                }

                {activeTab === 'flota' && (
                    <div className="flota-container">
                        <div className="flota-header">
                            <div>
                                <h2>Análisis de Flota</h2>
                                <p className="subtitle">Kilometraje y eficiencia de vehículos por período</p>
                            </div>
                            <div className="flota-filters">
                                <select value={mesSeleccionado} onChange={e => setMesSeleccionado(e.target.value)}>
                                    {periodosDisponibles.map(p => (
                                        <option key={p} value={p}>{formatPeriodo(p)}</option>
                                    ))}
                                </select>

                                <select value={filtroTipoVehiculo} onChange={e => setFiltroTipoVehiculo(e.target.value)} style={{marginLeft: '8px'}}>
                                    <option value="">Todos</option>
                                    <option value="propio">Propio</option>
                                    <option value="dcac">DCAC</option>
                                </select>

                                <label style={{marginLeft: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px'}}>
                                    <input type="checkbox" checked={mostrarSoloConCombustible} onChange={e => setMostrarSoloConCombustible(e.target.checked)} />
                                    <span>Solo con combustible</span>
                                </label>
                            </div>
                        </div>

                        <div className="flota-grid">
                            <div className="flota-table-card">
                                <h3>Uso de Vehículos ({formatPeriodo(mesSeleccionado)})</h3>
                                <div className="table-responsive">
                                    <table className="flota-table">
                                        <thead>
                                            <tr>
                                                <th>Comercial</th>
                                                <th>Patente</th>
                                                <th>Vehículo</th>
                                                <th className="text-right">KMs Empresa</th>
                                                <th className="text-right">KMs Totales</th>
                                                <th className="text-right">Amortización</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {kmsFiltrados.sort((a, b) => b.kmsEmpresa - a.kmsEmpresa).map((k, i) => (
                                                <tr key={i}>
                                                    <td>
                                                        <div className="user-cell">
                                                            <div className="user-avatar-mini">{k.comercial?.[0]}</div>
                                                            <span>{k.comercial || k.mail}</span>
                                                        </div>
                                                    </td>
                                                    <td><span className="patente-tag">{k.patente}</span></td>
                                                    <td>{k.vehiculoInfo}</td>
                                                    <td className="text-right">{k.kmsEmpresa.toLocaleString('es-AR')}</td>
                                                    <td className="text-right">{k.kmsTotales.toLocaleString('es-AR')}</td>
                                                    <td className="text-right">{formatCurrency(k.amortizacion)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="flota-stats">
                                <div className="indicator-card">
                                    <div className="indicator-icon-wrapper blue">
                                        <Icons.Fuel />
                                    </div>
                                    <div className="indicator-info">
                                        <span className="indicator-label">Total KMs Empresa</span>
                                        <span className="indicator-value">{totalKmsMes.toLocaleString('es-AR')} km</span>
                                    </div>
                                </div>

                                <div className="indicator-card">
                                    <div className="indicator-icon-wrapper green">
                                        <Icons.Money />
                                    </div>
                                    <div className="indicator-info">
                                        <span className="indicator-label">Amortización Total</span>
                                        <span className="indicator-value">
                                            {formatCurrency(kmsData.filter(k => k.periodo === mesSeleccionado).reduce((acc, k) => acc + k.amortizacion, 0))}
                                        </span>
                                    </div>
                                </div>

                                <div className="efficiency-rankings">
                                    <h3>Ranking de Eficiencia (Costo/Km)</h3>
                                    <div className="ranking-list">
                                        {eficienciaCombustible.filter(d => d.kms > 0).sort((a, b) => b.eficiencia - a.eficiencia).map((d, i) => (
                                            <div key={d.usuarioKey || d.usuario} className="ranking-item">
                                                <div className="rank-pos">{i + 1}</div>
                                                <div className="rank-name">{d.usuario}</div>
                                                <div className="rank-value">{formatCurrency(d.eficiencia)}/km</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default App;
