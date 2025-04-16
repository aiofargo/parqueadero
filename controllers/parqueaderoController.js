const { connection } = require('../config/database');
const { format } = require('date-fns');
const { es } = require('date-fns/locale');

// Mostrar formulario de entrada
const mostrarFormularioEntrada = async (req, res) => {
    try {
        const [tiposVehiculos] = await connection.execute(
            'SELECT id, nombre, descripcion, icono FROM tipos_vehiculos WHERE estado = ?',
            [1]
        );
        
        res.render('parqueadero/entrada', { 
            tiposVehiculos,
            error: null 
        });
    } catch (error) {
        console.error('Error al cargar tipos de vehículos:', error);
        res.render('parqueadero/entrada', { 
            error: 'Error al cargar los tipos de vehículos. Por favor, contacte al administrador.',
            tiposVehiculos: []
        });
    }
};

// Verificar placa
const verificarPlaca = async (req, res) => {
    const { placa } = req.query;
    try {
        const placaFormateada = placa.trim().toUpperCase();
        
        // Verificar si el vehículo está dentro del parqueadero
        const [vehiculoActivo] = await connection.query(
            'SELECT id, fecha_entrada, tipo_cobro FROM movimientos WHERE placa = ? AND estado = 1',
            [placaFormateada]
        );

        if (vehiculoActivo.length > 0) {
            return res.json({
                error: true,
                mensaje: 'Este vehículo ya se encuentra dentro del parqueadero',
                fechaEntrada: format(new Date(vehiculoActivo[0].fecha_entrada), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es }),
                requiereTipoVehiculo: false
            });
        }

        // 1. Verificar si tiene mensualidad activa
        const [mensualidades] = await connection.query(
            'SELECT m.*, tv.nombre as tipo_vehiculo, tv.id as tipo_vehiculo_id FROM mensualidades m ' +
            'INNER JOIN tipos_vehiculos tv ON m.tipo_vehiculo_id = tv.id ' +
            'WHERE m.placa = ? AND m.vigente_hasta >= CURDATE() AND m.estado = 1 ' +
            'ORDER BY m.vigente_hasta DESC LIMIT 1',
            [placaFormateada]
        );

        // 2. Verificar si es vehículo exento
        const [vehiculosExentos] = await connection.query(
            'SELECT ve.*, tv.nombre as tipo_vehiculo, tv.id as tipo_vehiculo_id FROM vehiculos_exentos ve ' +
            'INNER JOIN tipos_vehiculos tv ON ve.tipo_vehiculo_id = tv.id ' +
            'WHERE ve.placa = ? AND ve.fecha_fin >= CURDATE() AND ve.estado = 1',
            [placaFormateada]
        );

        let resultado = {
            error: false,
            requiereTipoVehiculo: true,
            tipo: 'TIEMPO',
            mensaje: null
        };

        if (mensualidades.length > 0) {
            resultado = {
                error: false,
                requiereTipoVehiculo: false,
                tipo: 'MENSUAL',
                tipoVehiculoId: mensualidades[0].tipo_vehiculo_id,
                tipoVehiculo: mensualidades[0].tipo_vehiculo,
                vencimiento: mensualidades[0].vigente_hasta,
                mensaje: 'Vehículo con mensualidad activa'
            };
        } else if (vehiculosExentos.length > 0) {
            resultado = {
                error: false,
                requiereTipoVehiculo: false,
                tipo: 'EXENTO',
                tipoVehiculoId: vehiculosExentos[0].tipo_vehiculo_id,
                tipoVehiculo: vehiculosExentos[0].tipo_vehiculo,
                mensaje: 'Vehículo exento de pago'
            };
        }

        res.json(resultado);
    } catch (error) {
        console.error('Error al verificar placa:', error);
        res.status(500).json({ 
            error: true, 
            mensaje: 'Error al verificar la placa',
            requiereTipoVehiculo: false
        });
    }
};

// Procesar entrada de vehículo
const procesarEntrada = async (req, res) => {
    try {
        const { placa, tipo_vehiculo_id } = req.body;
        
        // Validaciones iniciales
        if (!placa || !tipo_vehiculo_id) {
            throw new Error('La placa y el tipo de vehículo son obligatorios');
        }

        // Verificar si el vehículo ya está dentro del parqueadero
        const [vehiculoActivo] = await connection.query(
            'SELECT id, fecha_entrada FROM movimientos WHERE placa = ? AND estado = 1',
            [placa.trim().toUpperCase()]
        );

        if (vehiculoActivo.length > 0) {
            throw new Error('Este vehículo ya se encuentra dentro del parqueadero. ' +
                          'Entrada registrada el: ' + 
                          format(new Date(vehiculoActivo[0].fecha_entrada), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es }));
        }

        // Validar que tipo_vehiculo_id sea un número válido
        const tipoVehiculoId = parseInt(tipo_vehiculo_id);
        if (isNaN(tipoVehiculoId)) {
            throw new Error('El tipo de vehículo seleccionado no es válido');
        }

        // Verificar que el tipo de vehículo existe y obtener su información
        const [tiposVehiculo] = await connection.query(
            'SELECT id, nombre FROM tipos_vehiculos WHERE id = ? AND estado = 1',
            [tipoVehiculoId]
        );

        if (tiposVehiculo.length === 0) {
            throw new Error('El tipo de vehículo seleccionado no existe o está inactivo');
        }

        // 1. Verificar si tiene mensualidad activa
        const [mensualidades] = await connection.query(
            'SELECT id, vigente_hasta FROM mensualidades WHERE placa = ? AND vigente_hasta >= CURDATE() AND estado = 1 LIMIT 1',
            [placa.trim().toUpperCase()]
        );

        // 2. Verificar si es vehículo exento
        const [vehiculosExentos] = await connection.query(
            'SELECT id FROM vehiculos_exentos WHERE placa = ? AND fecha_fin >= CURDATE() AND estado = 1 LIMIT 1',
            [placa.trim().toUpperCase()]
        );

        const tipo_cobro = mensualidades.length > 0 ? 'MENSUAL' : 
                          vehiculosExentos.length > 0 ? 'EXENTO' : 'TIEMPO';

        // Registrar la entrada en la tabla de movimientos
        const [resultado] = await connection.query(
            'INSERT INTO movimientos (placa, tipo_vehiculo_id, tipo_cobro, usuario_entrada_id, observaciones_entrada) VALUES (?, ?, ?, ?, ?)',
            [
                placa.trim().toUpperCase(),
                tipoVehiculoId,
                tipo_cobro,
                req.session.usuario?.id || null,
                req.body.observaciones_entrada || null
            ]
        );

        // Preparar datos para el ticket
        const ticketData = {
            placa: placa.trim().toUpperCase(),
            fechaEntrada: format(new Date(), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es }),
            tipoVehiculo: tiposVehiculo[0].nombre,
            tipoCobro: tipo_cobro === 'MENSUAL' ? 'PAGO POR MENSUALIDAD' :
                      tipo_cobro === 'EXENTO' ? 'VEHÍCULO EXENTO' :
                      'COBRO POR TIEMPO DE PERMANENCIA',
            mensualidadVence: mensualidades.length > 0 && mensualidades[0].vigente_hasta ? 
                format(new Date(mensualidades[0].vigente_hasta), "d 'de' MMMM 'de' yyyy", { locale: es }) : 
                null,
            observaciones: req.body.observaciones_entrada || null,
            error: null,
            success: true,
            movimientoId: resultado.insertId,
            numeroTicket: `E-${String(resultado.insertId).padStart(6, '0')}`,
            session: req.session
        };

        res.render('parqueadero/ticket', ticketData);
    } catch (error) {
        console.error('Error detallado:', error);
        const [tiposVehiculos] = await connection.query(
            'SELECT id, nombre, descripcion FROM tipos_vehiculos WHERE estado = 1'
        );
        res.render('parqueadero/entrada', {
            error: error.message,
            tiposVehiculos,
            success: false
        });
    }
};

// Mostrar formulario de salida
const mostrarFormularioSalida = async (req, res) => {
    try {
        // Obtener vehículos en patio
        const [vehiculosEnPatio] = await connection.query(
            `SELECT m.placa, m.fecha_entrada, tv.nombre as tipo_vehiculo, m.tipo_cobro,
                    CASE 
                        WHEN m.tipo_cobro = 'MENSUAL' THEN (
                            SELECT vigente_hasta 
                            FROM mensualidades 
                            WHERE placa = m.placa AND vigente_hasta >= CURDATE() 
                            ORDER BY vigente_hasta DESC 
                            LIMIT 1
                        )
                        WHEN m.tipo_cobro = 'EXENTO' THEN (
                            SELECT fecha_fin 
                            FROM vehiculos_exentos 
                            WHERE placa = m.placa AND fecha_fin >= CURDATE() 
                            LIMIT 1
                        )
                        ELSE NULL 
                    END as fecha_vencimiento
             FROM movimientos m 
             INNER JOIN tipos_vehiculos tv ON m.tipo_vehiculo_id = tv.id 
             WHERE m.estado = 1 
             ORDER BY m.fecha_entrada DESC`
        );

        // Formatear las fechas
        const vehiculosFormateados = vehiculosEnPatio.map(vehiculo => ({
            ...vehiculo,
            fecha_entrada: format(new Date(vehiculo.fecha_entrada), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es }),
            fecha_vencimiento: vehiculo.fecha_vencimiento ? 
                format(new Date(vehiculo.fecha_vencimiento), "d 'de' MMMM 'de' yyyy", { locale: es }) : 
                null
        }));

        res.render('parqueadero/salida', { 
            error: null,
            vehiculosEnPatio: vehiculosFormateados
        });
    } catch (error) {
        console.error('Error al mostrar formulario de salida:', error);
        res.render('parqueadero/salida', { 
            error: 'Error al cargar el formulario. Por favor, contacte al administrador.',
            vehiculosEnPatio: []
        });
    }
};

// Verificar vehículo para salida
const verificarVehiculoSalida = async (req, res) => {
    const { placa } = req.query;
    try {
        if (!placa) {
            return res.status(400).json({
                error: true,
                mensaje: 'La placa es requerida'
            });
        }

        const placaFormateada = placa.trim().toUpperCase();
        
        // Verificar si el vehículo está dentro del parqueadero
        const [movimientos] = await connection.query(
            `SELECT m.*, tv.nombre as tipo_vehiculo, tv.tarifa_minuto, tv.tarifa_plena, tv.tarifa_24_horas 
             FROM movimientos m 
             INNER JOIN tipos_vehiculos tv ON m.tipo_vehiculo_id = tv.id 
             WHERE m.placa = ? AND m.estado = 1`,
            [placaFormateada]
        );

        if (!movimientos || movimientos.length === 0) {
            return res.status(404).json({
                error: true,
                mensaje: 'Este vehículo no se encuentra dentro del parqueadero'
            });
        }

        const vehiculo = movimientos[0];
        const fechaEntrada = new Date(vehiculo.fecha_entrada);
        const fechaActual = new Date();
        const esSabado = fechaActual.getDay() === 6;

        // Verificar si tiene mensualidad activa
        const [mensualidades] = await connection.query(
            'SELECT vigente_hasta FROM mensualidades WHERE placa = ? AND vigente_hasta >= CURDATE() AND estado = 1 LIMIT 1',
            [placaFormateada]
        );

        // Verificar si es vehículo exento
        const [exentos] = await connection.query(
            'SELECT fecha_fin FROM vehiculos_exentos WHERE placa = ? AND fecha_fin >= CURDATE() AND estado = 1 LIMIT 1',
            [placaFormateada]
        );

        let resultado = {
            error: false,
            placa: placaFormateada,
            fechaEntrada: format(fechaEntrada, "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es }),
            fechaSalida: format(fechaActual, "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es }),
            tipoVehiculo: vehiculo.tipo_vehiculo,
            movimientoId: vehiculo.id
        };

        if (mensualidades && mensualidades.length > 0) {
            resultado.tipo = 'MENSUAL';
            resultado.vencimiento = format(new Date(mensualidades[0].vigente_hasta), "d 'de' MMMM 'de' yyyy", { locale: es });
            resultado.valor = 0;
        } else if (exentos && exentos.length > 0) {
            resultado.tipo = 'EXENTO';
            resultado.vencimiento = format(new Date(exentos[0].fecha_fin), "d 'de' MMMM 'de' yyyy", { locale: es });
            resultado.valor = 0;
        } else {
            // Cálculo de tiempo y valor para cobro por minutos
            const tiempoTotal = fechaActual - fechaEntrada; // Diferencia en milisegundos
            const minutosTotales = Math.floor(tiempoTotal / (1000 * 60));
            let minutosACobrar = minutosTotales;
            
            // Aplicar hora gratis los sábados
            if (esSabado) {
                minutosACobrar = Math.max(0, minutosTotales - 60); // Resta 60 minutos (1 hora gratis)
            }

            // Cálculo del valor según las reglas
            let valor = 0;
            const minutosEnDosHoras = 120;
            const minutosEn12Horas = 720;
            const minutosEn24Horas = 1440;

            if (minutosACobrar <= minutosEnDosHoras) {
                // Cobro por minuto hasta 2 horas
                valor = minutosACobrar * vehiculo.tarifa_minuto;
            } else if (minutosACobrar <= minutosEn12Horas) {
                // Tarifa plena 12 horas
                valor = vehiculo.tarifa_plena;
            } else {
                // Calcular días completos y el tiempo restante
                const diasCompletos = Math.floor(minutosACobrar / minutosEn24Horas);
                const minutosRestantes = minutosACobrar % minutosEn24Horas;

                valor = (diasCompletos * vehiculo.tarifa_24_horas); // Valor por días completos

                // Calcular el valor del tiempo restante
                if (minutosRestantes <= minutosEnDosHoras) {
                    valor += minutosRestantes * vehiculo.tarifa_minuto;
                } else if (minutosRestantes <= minutosEn12Horas) {
                    valor += vehiculo.tarifa_plena;
                } else {
                    valor += vehiculo.tarifa_24_horas;
                }
            }

            resultado.tipo = 'TIEMPO';
            resultado.minutos = minutosTotales;
            resultado.minutosACobrar = minutosACobrar;
            resultado.valor = valor;
            resultado.esSabado = esSabado;
        }

        return res.json(resultado);
    } catch (error) {
        console.error('Error detallado al verificar vehículo para salida:', error);
        return res.status(500).json({ 
            error: true, 
            mensaje: 'Error al verificar el vehículo: ' + (error.message || 'Error desconocido')
        });
    }
};

// Procesar salida de vehículo
const procesarSalida = async (req, res) => {
    try {
        const { 
            movimientoId, 
            valor,
            requiereFactura,
            correoElectronico,
            documentoIdentidad,
            nombreCompleto,
            numeroCelular
        } = req.body;
        
        // Obtener el movimiento y tipo de vehículo para calcular el IVA
        const [movimientos] = await connection.query(
            `SELECT m.*, tv.nombre as tipo_vehiculo, tv.porcentaje_iva, 
                    tv.tarifa_minuto, tv.tarifa_plena, tv.tarifa_24_horas
             FROM movimientos m 
             INNER JOIN tipos_vehiculos tv ON m.tipo_vehiculo_id = tv.id 
             WHERE m.id = ?`,
            [movimientoId]
        );

        if (movimientos.length === 0) {
            throw new Error('No se encontró el movimiento');
        }

        const movimiento = movimientos[0];
        const fechaEntrada = new Date(movimiento.fecha_entrada);
        const fechaSalida = new Date();
        const tiempoTotal = fechaSalida - fechaEntrada; // Diferencia en milisegundos
        const minutosTotales = Math.floor(tiempoTotal / (1000 * 60));
        const horasTotales = Math.floor(minutosTotales / 60);
        const minutosRestantes = minutosTotales % 60;

        // Cálculo detallado del tiempo y valor
        const minutosEnDosHoras = 120;
        const minutosEn12Horas = 720;
        const minutosEn24Horas = 1440;
        const diasCompletos = Math.floor(minutosTotales / minutosEn24Horas);
        const minutosRestantesDespuesDias = minutosTotales % minutosEn24Horas;

        let desgloseCobro = [];
        let valorBase = 0;

        // Cobro por días completos
        if (diasCompletos > 0) {
            valorBase += diasCompletos * movimiento.tarifa_24_horas;
            desgloseCobro.push({
                concepto: `${diasCompletos} día${diasCompletos > 1 ? 's' : ''} (24 horas)`,
                valor: diasCompletos * movimiento.tarifa_24_horas
            });
        }

        // Cobro por tiempo restante
        if (minutosRestantesDespuesDias > 0) {
            if (minutosRestantesDespuesDias <= minutosEnDosHoras) {
                // Cobro por minutos
                const valorMinutos = minutosRestantesDespuesDias * movimiento.tarifa_minuto;
                valorBase += valorMinutos;
                desgloseCobro.push({
                    concepto: `${minutosRestantesDespuesDias} minutos`,
                    valor: valorMinutos
                });
            } else if (minutosRestantesDespuesDias <= minutosEn12Horas) {
                // Tarifa plena
                valorBase += movimiento.tarifa_plena;
                desgloseCobro.push({
                    concepto: 'Tarifa plena',
                    valor: movimiento.tarifa_plena
                });
            } else {
                // Tarifa 24 horas adicional
                valorBase += movimiento.tarifa_24_horas;
                desgloseCobro.push({
                    concepto: 'Día adicional (24 horas)',
                    valor: movimiento.tarifa_24_horas
                });
            }
        }

        // Cálculo del IVA (teniendo en cuenta que el valor ya incluye IVA)
        const porcentajeIva = movimiento.porcentaje_iva || 0;
        const valorSinIva = valorBase / (1 + (porcentajeIva / 100));
        const valorIva = valorBase - valorSinIva;

        // Actualizar el movimiento con los valores calculados
        await connection.query(
            `UPDATE movimientos 
             SET fecha_salida = NOW(), 
                 valor = ?,
                 valor_iva = ?,
                 valor_total = ?,
                 estado = 0, 
                 usuario_salida_id = ?,
                 observaciones_salida = ?
             WHERE id = ?`,
            [
                valorSinIva, 
                valorIva, 
                valorBase, 
                req.session.usuario?.id || null,
                req.body.observaciones_salida || null,
                movimientoId
            ]
        );

        // Si requiere factura electrónica, guardar los datos
        if (requiereFactura === 'on' && correoElectronico && documentoIdentidad && nombreCompleto && numeroCelular) {
            await connection.query(
                `INSERT INTO cli_factura_e 
                 (movimiento_id, documento_identidad, nombre_completo, correo_electronico, numero_celular)
                 VALUES (?, ?, ?, ?, ?)`,
                [movimientoId, documentoIdentidad, nombreCompleto, correoElectronico, numeroCelular]
            );
        }

        // Verificar mensualidad o exención
        const [mensualidad] = await connection.query(
            'SELECT vigente_hasta FROM mensualidades WHERE placa = ? AND vigente_hasta >= CURDATE() AND estado = 1 LIMIT 1',
            [movimiento.placa]
        );

        const [exento] = await connection.query(
            'SELECT fecha_fin FROM vehiculos_exentos WHERE placa = ? AND fecha_fin >= CURDATE() AND estado = 1 LIMIT 1',
            [movimiento.placa]
        );

        // Obtener datos de facturación electrónica si existen
        const [datosFactura] = await connection.query(
            'SELECT * FROM cli_factura_e WHERE movimiento_id = ? AND estado = 1 ORDER BY id DESC LIMIT 1',
            [movimientoId]
        );

        // Preparar datos para el ticket
        const ticketData = {
            placa: movimiento.placa,
            tipoVehiculo: movimiento.tipo_vehiculo,
            fechaEntrada: format(fechaEntrada, "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es }),
            fechaSalida: format(fechaSalida, "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es }),
            fechaActual: format(new Date(), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es }),
            tiempoTotal: {
                dias: diasCompletos,
                horas: Math.floor(minutosRestantesDespuesDias / 60),
                minutos: minutosRestantesDespuesDias % 60
            },
            desgloseCobro: desgloseCobro,
            tipoCobro: mensualidad.length > 0 ? 'MENSUAL' : 
                      exento.length > 0 ? 'EXENTO' : 'TIEMPO',
            esTiempo: !(mensualidad.length > 0 || exento.length > 0),
            esMensual: mensualidad.length > 0,
            esExento: exento.length > 0,
            valor: valorSinIva,
            valorIva: valorIva,
            valorTotal: valorBase,
            porcentajeIva: porcentajeIva,
            tarifas: {
                minuto: movimiento.tarifa_minuto,
                plena: movimiento.tarifa_plena,
                dia: movimiento.tarifa_24_horas
            },
            mensualidadVence: mensualidad.length > 0 ? 
                format(new Date(mensualidad[0].vigente_hasta), "d 'de' MMMM 'de' yyyy", { locale: es }) : null,
            exentoVence: exento.length > 0 ? 
                format(new Date(exento[0].fecha_fin), "d 'de' MMMM 'de' yyyy", { locale: es }) : null,
            error: null,
            success: true,
            session: req.session,
            numeroTicket: `S-${String(movimientoId).padStart(6, '0')}`,
            requiereFactura: datosFactura && datosFactura.length > 0,
            correoElectronico: datosFactura && datosFactura.length > 0 ? datosFactura[0].correo_electronico : null,
            documentoIdentidad: datosFactura && datosFactura.length > 0 ? datosFactura[0].documento_identidad : null,
            nombreCompleto: datosFactura && datosFactura.length > 0 ? datosFactura[0].nombre_completo : null,
            numeroCelular: datosFactura && datosFactura.length > 0 ? datosFactura[0].numero_celular : null,
            observacionesEntrada: movimiento.observaciones_entrada,
            observacionesSalida: req.body.observaciones_salida
        };

        res.render('parqueadero/ticket-salida', ticketData);
    } catch (error) {
        console.error('Error al procesar salida:', error);
        res.render('parqueadero/salida', {
            error: error.message,
            success: false
        });
    }
};

// Obtener estadísticas del parqueadero
const obtenerEstadisticas = async (req, res) => {
    try {
        const fecha = req.query.fecha || format(new Date(), 'yyyy-MM-dd');
        const horaInicio = req.query.horaInicio || '00:00';
        const horaFin = req.query.horaFin || '23:59';

        // Construir el rango de fecha y hora
        const fechaHoraInicio = `${fecha} ${horaInicio}:00`;
        const fechaHoraFin = `${fecha} ${horaFin}:59`;

        // Obtener total de vehículos actualmente en el parqueadero por tipo de cobro
        const [vehiculosActivos] = await connection.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN tipo_cobro = 'TIEMPO' THEN 1 ELSE 0 END) as tiempo,
                SUM(CASE WHEN tipo_cobro = 'MENSUAL' THEN 1 ELSE 0 END) as mensual,
                SUM(CASE WHEN tipo_cobro = 'EXENTO' THEN 1 ELSE 0 END) as exento
            FROM movimientos 
            WHERE estado = 1
        `);

        // Obtener vehículos en patio por tipo de vehículo
        const [vehiculosPorTipo] = await connection.query(`
            SELECT 
                tv.nombre,
                COUNT(m.id) as cantidad
            FROM tipos_vehiculos tv
            LEFT JOIN movimientos m ON tv.id = m.tipo_vehiculo_id AND m.estado = 1
            WHERE tv.estado = 1
            GROUP BY tv.id, tv.nombre
            ORDER BY tv.nombre
        `);

        // Obtener movimientos del período seleccionado por tipo de vehículo
        const [movimientosPorTipo] = await connection.query(`
            SELECT 
                tv.nombre,
                COUNT(m.id) as total_entradas,
                SUM(CASE WHEN m.estado = 0 THEN 1 ELSE 0 END) as total_salidas,
                COALESCE(SUM(CASE WHEN m.estado = 0 THEN m.valor_total ELSE 0 END), 0) as total_ingresos
            FROM tipos_vehiculos tv
            LEFT JOIN movimientos m ON tv.id = m.tipo_vehiculo_id 
            AND m.fecha_entrada BETWEEN ? AND ?
            WHERE tv.estado = 1
            GROUP BY tv.id, tv.nombre
            ORDER BY tv.nombre
        `, [fechaHoraInicio, fechaHoraFin]);

        // Obtener movimientos del período (entradas desglosadas, salidas e ingresos)
        const [movimientosDia] = await connection.query(`
            SELECT 
                COUNT(*) as entradas_total,
                SUM(CASE WHEN tipo_cobro = 'TIEMPO' THEN 1 ELSE 0 END) as entradas_tiempo,
                SUM(CASE WHEN tipo_cobro = 'MENSUAL' THEN 1 ELSE 0 END) as entradas_mensual,
                SUM(CASE WHEN tipo_cobro = 'EXENTO' THEN 1 ELSE 0 END) as entradas_exento,
                SUM(CASE WHEN estado = 0 THEN 1 ELSE 0 END) as salidas,
                COALESCE(SUM(CASE WHEN estado = 0 THEN valor_total ELSE 0 END), 0) as ingresos
            FROM movimientos 
            WHERE fecha_entrada BETWEEN ? AND ?
        `, [fechaHoraInicio, fechaHoraFin]);

        // Preparar respuesta
        const respuesta = {
            activos: {
                total: vehiculosActivos[0].total || 0,
                tiempo: vehiculosActivos[0].tiempo || 0,
                mensual: vehiculosActivos[0].mensual || 0,
                exento: vehiculosActivos[0].exento || 0
            },
            vehiculosPorTipo: vehiculosPorTipo,
            movimientosPorTipo: movimientosPorTipo,
            movimientos: {
                entradas: {
                    total: movimientosDia[0].entradas_total || 0,
                    tiempo: movimientosDia[0].entradas_tiempo || 0,
                    mensual: movimientosDia[0].entradas_mensual || 0,
                    exento: movimientosDia[0].entradas_exento || 0
                },
                salidas: movimientosDia[0].salidas || 0,
                ingresos: movimientosDia[0].ingresos || 0
            },
            filtros: {
                fecha,
                horaInicio,
                horaFin
            }
        };

        res.json(respuesta);

    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({ 
            error: true, 
            mensaje: 'Error al obtener las estadísticas del parqueadero'
        });
    }
};

module.exports = {
    mostrarFormularioEntrada,
    verificarPlaca,
    procesarEntrada,
    mostrarFormularioSalida,
    verificarVehiculoSalida,
    procesarSalida,
    obtenerEstadisticas
}; 