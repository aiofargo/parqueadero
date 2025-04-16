const { connection } = require('../config/database');

const mensualidadesController = {
    // Obtener todas las mensualidades
    obtenerMensualidades: async (req, res) => {
        try {
            const filtroPlaca = req.query.placa ? req.query.placa.trim() : '';
            let whereClause = '';
            let params = [];

            if (filtroPlaca) {
                whereClause = 'AND m.placa LIKE ?';
                params.push(`%${filtroPlaca}%`);
            }

            const [mensualidades] = await connection.query(`
                WITH RangoVigencia AS (
                    SELECT 
                        placa,
                        MIN(vigente_desde) as primera_vigencia,
                        MAX(vigente_hasta) as ultima_vigencia
                    FROM mensualidades
                    WHERE estado = 1
                    GROUP BY placa
                )
                SELECT 
                    m.id,
                    m.placa,
                    m.nombre_dueno,
                    tv.nombre as tipo_vehiculo,
                    m.fecha_pago,
                    rv.primera_vigencia as vigente_desde,
                    rv.ultima_vigencia as vigente_hasta,
                    m.valor_total,
                    m.estado,
                    m.pago_id,
                    u.nombres as usuario_nombre
                FROM mensualidades m 
                JOIN tipos_vehiculos tv ON m.tipo_vehiculo_id = tv.id
                JOIN usuarios u ON m.usuario_id = u.id
                JOIN RangoVigencia rv ON m.placa = rv.placa
                LEFT JOIN pagos_mensualidades p ON m.pago_id = p.id
                WHERE m.vigente_hasta = rv.ultima_vigencia
                ${whereClause}
                ORDER BY m.fecha_pago DESC
            `, params);

            res.render('mensualidades/lista', { 
                mensualidades,
                filtroPlaca
            });
        } catch (error) {
            console.error('Error al obtener mensualidades:', error);
            res.status(500).send('Error al obtener mensualidades');
        }
    },

    // Mostrar formulario de creación o redirigir a renovación si existe
    mostrarFormularioCreacion: async (req, res) => {
        try {
            // Si viene una placa en la URL, verificar si existe
            const placa = req.query.placa;
            if (placa) {
                // Verificar si el vehículo está exento
                const [vehiculoExento] = await connection.query(`
                    SELECT * FROM vehiculos_exentos 
                    WHERE placa = ? 
                    AND estado = 1 
                    AND fecha_inicio <= CURDATE() 
                    AND fecha_fin >= CURDATE()
                `, [placa]);

                if (vehiculoExento.length > 0) {
                    return res.status(400).send('Este vehículo está exento de pago hasta ' + 
                        new Date(vehiculoExento[0].fecha_fin).toLocaleDateString('es-CO', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        }));
                }

                // Buscar la mensualidad más reciente para esta placa
                const [mensualidadExistente] = await connection.query(`
                    SELECT m.* 
                    FROM mensualidades m
                    WHERE m.placa = ?
                    ORDER BY m.vigente_hasta DESC
                    LIMIT 1
                `, [placa]);

                if (mensualidadExistente.length > 0) {
                    // Si existe, redirigir a la página de renovación
                    return res.redirect(`/mensualidades/renovar/${mensualidadExistente[0].id}`);
                }
            }

            // Si no hay placa o no existe mensualidad, mostrar formulario de creación
            const [tiposVehiculos] = await connection.query('SELECT * FROM tipos_vehiculos WHERE estado = 1');
            res.render('mensualidades/formulario', { 
                tiposVehiculos,
                placa: placa || '' // Pasar la placa al formulario si existe
            });
        } catch (error) {
            console.error('Error al cargar formulario:', error);
            res.status(500).send('Error al cargar formulario');
        }
    },

    // Crear nueva mensualidad
    crearMensualidad: async (req, res) => {
        try {
            const {
                placa,
                nombre_dueno,
                celular,
                email,
                tipo_vehiculo_id
            } = req.body;

            // Verificar si el vehículo está exento
            const [vehiculoExento] = await connection.query(`
                SELECT * FROM vehiculos_exentos 
                WHERE placa = ? 
                AND estado = 1 
                AND fecha_inicio <= CURDATE() 
                AND fecha_fin >= CURDATE()
            `, [placa]);

            if (vehiculoExento.length > 0) {
                return res.status(400).send('Este vehículo está exento de pago hasta ' + 
                    new Date(vehiculoExento[0].fecha_fin).toLocaleDateString('es-CO', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    }));
            }

            // Obtener la tarifa mensual y el IVA del tipo de vehículo
            const [tipoVehiculo] = await connection.query(
                'SELECT tarifa_mensual, porcentaje_iva FROM tipos_vehiculos WHERE id = ?',
                [tipo_vehiculo_id]
            );

            if (!tipoVehiculo.length) {
                throw new Error('Tipo de vehículo no encontrado');
            }

            const fecha_pago = new Date();
            const vigente_desde = fecha_pago;
            const vigente_hasta = new Date(fecha_pago);
            vigente_hasta.setDate(vigente_hasta.getDate() + 30); // 30 días desde la fecha de pago

            const valor_total = tipoVehiculo[0].tarifa_mensual;
            // Calcular el IVA incluido en el valor total
            const valor_iva = (valor_total * tipoVehiculo[0].porcentaje_iva) / (100 + tipoVehiculo[0].porcentaje_iva);

            await connection.query(
                `INSERT INTO mensualidades (
                    placa, nombre_dueno, celular, email, fecha_pago, 
                    vigente_desde, vigente_hasta, tipo_vehiculo_id, 
                    valor_total, valor_iva, usuario_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    placa, nombre_dueno, celular, email, fecha_pago,
                    vigente_desde, vigente_hasta, tipo_vehiculo_id,
                    valor_total, valor_iva, req.session.usuario.id
                ]
            );

            res.redirect('/mensualidades');
        } catch (error) {
            console.error('Error al crear mensualidad:', error);
            res.status(500).send('Error al crear mensualidad');
        }
    },

    // Mostrar detalles de la mensualidad
    mostrarDetallesMensualidad: async (req, res) => {
        try {
            // Obtener los detalles de la mensualidad actual
            const [mensualidades] = await connection.query(`
                SELECT m.*, tv.nombre as tipo_vehiculo, u.nombres as usuario_nombre 
                FROM mensualidades m 
                JOIN tipos_vehiculos tv ON m.tipo_vehiculo_id = tv.id
                JOIN usuarios u ON m.usuario_id = u.id
                WHERE m.id = ?
            `, [req.params.id]);

            if (mensualidades.length === 0) {
                return res.status(404).send('Mensualidad no encontrada');
            }

            // Obtener el historial completo de pagos para este vehículo
            const [historialPagos] = await connection.query(`
                SELECT 
                    p.id as pago_id,
                    p.fecha_pago,
                    p.valor_total,
                    p.valor_iva,
                    p.cantidad_meses,
                    p.metodo_pago,
                    p.referencia_pago,
                    m.vigente_desde,
                    m.vigente_hasta,
                    u.nombres as usuario_registro,
                    p.estado as estado_pago
                FROM mensualidades m
                JOIN pagos_mensualidades p ON m.pago_id = p.id
                JOIN usuarios u ON p.usuario_id = u.id
                WHERE m.placa = ?
                ORDER BY p.fecha_pago DESC
            `, [mensualidades[0].placa]);

            // Formatear las fechas y valores para el historial
            const historialFormateado = historialPagos.map(pago => ({
                ...pago,
                fecha_pago: new Date(pago.fecha_pago).toLocaleDateString('es-CO', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }),
                vigente_desde: new Date(pago.vigente_desde).toLocaleDateString('es-CO', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }),
                vigente_hasta: new Date(pago.vigente_hasta).toLocaleDateString('es-CO', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }),
                valor_total: new Intl.NumberFormat('es-CO', {
                    style: 'currency',
                    currency: 'COP'
                }).format(pago.valor_total),
                valor_iva: new Intl.NumberFormat('es-CO', {
                    style: 'currency',
                    currency: 'COP'
                }).format(pago.valor_iva)
            }));

            res.render('mensualidades/ver', { 
                mensualidad: mensualidades[0],
                historialPagos: historialFormateado
            });
        } catch (error) {
            console.error('Error al obtener mensualidad:', error);
            res.status(500).send('Error al obtener mensualidad');
        }
    },

    // Renovar mensualidad
    renovarMensualidad: async (req, res) => {
        try {
            const { id } = req.params;
            
            // Obtener la mensualidad actual
            const [mensualidad] = await connection.query(
                'SELECT * FROM mensualidades WHERE id = ?',
                [id]
            );

            if (!mensualidad.length) {
                return res.status(404).send('Mensualidad no encontrada');
            }

            // Verificar si el vehículo está exento
            const [vehiculoExento] = await connection.query(`
                SELECT * FROM vehiculos_exentos 
                WHERE placa = ? 
                AND estado = 1 
                AND fecha_inicio <= CURDATE() 
                AND fecha_fin >= CURDATE()
            `, [mensualidad[0].placa]);

            if (vehiculoExento.length > 0) {
                return res.status(400).send('Este vehículo está exento de pago hasta ' + 
                    new Date(vehiculoExento[0].fecha_fin).toLocaleDateString('es-CO', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    }));
            }

            // Obtener la tarifa actual del tipo de vehículo
            const [tipoVehiculo] = await connection.query(
                'SELECT tarifa_mensual, porcentaje_iva FROM tipos_vehiculos WHERE id = ?',
                [mensualidad[0].tipo_vehiculo_id]
            );

            const fecha_pago = new Date();
            const vigente_desde = new Date(mensualidad[0].vigente_hasta);
            const vigente_hasta = new Date(vigente_desde);
            vigente_hasta.setDate(vigente_hasta.getDate() + 30);

            const valor_total = tipoVehiculo[0].tarifa_mensual;
            // Calcular el IVA incluido en el valor total
            const valor_iva = (valor_total * tipoVehiculo[0].porcentaje_iva) / (100 + tipoVehiculo[0].porcentaje_iva);

            // Crear nueva mensualidad basada en la anterior
            await connection.query(
                `INSERT INTO mensualidades (
                    placa, nombre_dueno, celular, email, fecha_pago,
                    vigente_desde, vigente_hasta, tipo_vehiculo_id,
                    valor_total, valor_iva, usuario_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    mensualidad[0].placa,
                    mensualidad[0].nombre_dueno,
                    mensualidad[0].celular,
                    mensualidad[0].email,
                    fecha_pago,
                    vigente_desde,
                    vigente_hasta,
                    mensualidad[0].tipo_vehiculo_id,
                    valor_total,
                    valor_iva,
                    req.session.usuario.id
                ]
            );

            res.redirect('/mensualidades');
        } catch (error) {
            console.error('Error al renovar mensualidad:', error);
            res.status(500).send('Error al renovar mensualidad');
        }
    },

    // Verificar si una mensualidad puede ser renovada
    verificarRenovacion: async (req, res) => {
        try {
            const { id } = req.params;
            const [mensualidad] = await connection.query(`
                SELECT m.*, tv.nombre as tipo_vehiculo, tv.tarifa_mensual, tv.porcentaje_iva
                FROM mensualidades m 
                JOIN tipos_vehiculos tv ON m.tipo_vehiculo_id = tv.id
                WHERE m.id = ?
            `, [id]);

            if (mensualidad.length === 0) {
                return res.status(404).json({ error: 'Mensualidad no encontrada' });
            }

            const hoy = new Date();
            const fechaVencimiento = new Date(mensualidad[0].vigente_hasta);
            const diasParaVencer = Math.ceil((fechaVencimiento - hoy) / (1000 * 60 * 60 * 24));

            // Calcular valores para un mes
            const valorTotalMes = mensualidad[0].tarifa_mensual;
            const valorSinIvaMes = Math.round(valorTotalMes / (1 + (mensualidad[0].porcentaje_iva / 100)));
            const valorIvaMes = valorTotalMes - valorSinIvaMes;

            // Calcular fecha hasta la que está pago
            const fechaPago = new Date(mensualidad[0].vigente_hasta);
            const fechaPagoFormateada = fechaPago.toLocaleDateString('es-CO', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            // Calcular próxima fecha de vencimiento (un mes después de la fecha actual de vencimiento)
            const proximoVencimiento = new Date(fechaVencimiento);
            proximoVencimiento.setMonth(proximoVencimiento.getMonth() + 1);
            const proximoVencimientoFormateado = proximoVencimiento.toLocaleDateString('es-CO', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            res.render('mensualidades/renovar', {
                mensualidad: mensualidad[0],
                diasParaVencer,
                fechaPagoActual: fechaPagoFormateada,
                proximoVencimiento: proximoVencimientoFormateado,
                valorTotalMes,
                valorIvaMes,
                valorSinIvaMes
            });
        } catch (error) {
            console.error('Error al verificar renovación:', error);
            res.status(500).send('Error al verificar renovación');
        }
    },

    // Previsualizar ticket antes de confirmar
    previsualizarTicket: async (req, res) => {
        try {
            const { id } = req.params;
            const { metodo_pago, referencia_pago, cantidad_meses, es_nueva } = req.body;
            const cantidadMeses = parseInt(cantidad_meses) || 1;

            let mensualidad;
            let vigente_desde, vigente_hasta;

            if (es_nueva) {
                // Para nueva mensualidad, crear objeto temporal con los datos del formulario
                const [tipoVehiculo] = await connection.query(
                    'SELECT * FROM tipos_vehiculos WHERE id = ?',
                    [req.body.tipo_vehiculo_id]
                );

                if (!tipoVehiculo.length) {
                    throw new Error('Tipo de vehículo no encontrado');
                }

                vigente_desde = new Date();
                vigente_hasta = new Date(vigente_desde);
                vigente_hasta.setMonth(vigente_hasta.getMonth() + cantidadMeses);

                mensualidad = [{
                    placa: req.body.placa,
                    nombre_dueno: req.body.nombre_dueno,
                    celular: req.body.celular,
                    email: req.body.email,
                    tipo_vehiculo_id: req.body.tipo_vehiculo_id,
                    tipo_vehiculo: tipoVehiculo[0].nombre,
                    tarifa_mensual: tipoVehiculo[0].tarifa_mensual,
                    porcentaje_iva: tipoVehiculo[0].porcentaje_iva,
                    vigente_desde: vigente_desde,
                    vigente_hasta: vigente_hasta,
                    es_nueva: true
                }];
            } else {
                // Para renovación, obtener mensualidad existente
                [mensualidad] = await connection.query(`
                    SELECT m.*, tv.nombre as tipo_vehiculo, tv.tarifa_mensual, tv.porcentaje_iva
                    FROM mensualidades m 
                    JOIN tipos_vehiculos tv ON m.tipo_vehiculo_id = tv.id
                    WHERE m.id = ?
                `, [id]);

                if (!mensualidad.length) {
                    throw new Error('Mensualidad no encontrada');
                }

                // Calcular fechas de vigencia para renovación
                const fechaActual = new Date();
                const fechaVencimientoActual = new Date(mensualidad[0].vigente_hasta);

                // Si la mensualidad actual aún no ha vencido, la nueva vigencia comienza desde el vencimiento
                vigente_desde = fechaVencimientoActual > fechaActual ? 
                    new Date(fechaVencimientoActual) : new Date(fechaActual);

                vigente_hasta = new Date(vigente_desde);
                vigente_hasta.setMonth(vigente_hasta.getMonth() + cantidadMeses);

                // Verificar si hay traslapes con otras mensualidades
                const [mensualidadesSolapadas] = await connection.query(`
                    SELECT * FROM mensualidades 
                    WHERE placa = ? 
                    AND estado = 1
                    AND id != ?
                    AND (
                        (vigente_desde <= ? AND vigente_hasta >= ?) OR
                        (vigente_desde <= ? AND vigente_hasta >= ?) OR
                        (vigente_desde >= ? AND vigente_hasta <= ?)
                    )
                `, [
                    mensualidad[0].placa,
                    id,
                    vigente_desde, vigente_desde,
                    vigente_hasta, vigente_hasta,
                    vigente_desde, vigente_hasta
                ]);

                if (mensualidadesSolapadas.length > 0) {
                    throw new Error('Ya existe una mensualidad activa para este vehículo en el período seleccionado');
                }
            }

            // Calcular valores totales
            const valorTotalMes = mensualidad[0].tarifa_mensual;
            const valorTotal = valorTotalMes * cantidadMeses;
            const valorSinIva = Math.round(valorTotal / (1 + (mensualidad[0].porcentaje_iva / 100)));
            const valorIva = valorTotal - valorSinIva;

            // Formatear valores con separadores de miles
            const formatearNumero = (numero) => {
                return numero.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
            };

            // Formatear fechas para mostrar
            const vigente_desde_formato = vigente_desde.toLocaleDateString('es-CO', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            const vigente_hasta_formato = vigente_hasta.toLocaleDateString('es-CO', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            // Generar número de recibo si es pago en efectivo
            let referenciaFinal = referencia_pago;
            if (metodo_pago === 'efectivo') {
                const [ultimoRecibo] = await connection.query(
                    `SELECT MAX(CAST(SUBSTRING(referencia_pago, 2) AS UNSIGNED)) as ultimo_numero 
                     FROM pagos_mensualidades 
                     WHERE metodo_pago = 'efectivo' 
                     AND referencia_pago LIKE 'R%'`
                );
                
                const ultimoNumero = ultimoRecibo[0].ultimo_numero || 0;
                referenciaFinal = `R${String(ultimoNumero + 1).padStart(6, '0')}`;
            }

            res.render('mensualidades/ticket', {
                previsualizar: true,
                mensualidad: mensualidad[0],
                metodo_pago,
                referencia_pago: referenciaFinal,
                cantidad_meses: cantidadMeses,
                valorTotal: formatearNumero(valorTotal),
                valorIva: formatearNumero(valorIva),
                valorSinIva: formatearNumero(valorSinIva),
                vigente_desde: vigente_desde_formato,
                vigente_hasta: vigente_hasta_formato,
                fechaActual: new Date().toLocaleDateString('es-CO', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }),
                usuario: req.session.usuario,
                es_nueva: es_nueva === '1'
            });
        } catch (error) {
            console.error('Error al previsualizar ticket:', error);
            res.status(500).json({
                error: 'Error al previsualizar ticket',
                details: error.message
            });
        }
    },

    // Ver ticket de un pago existente
    verTicket: async (req, res) => {
        try {
            const { id } = req.params;

            const [pago] = await connection.query(`
                SELECT p.*, m.*, tv.nombre as tipo_vehiculo, u.nombres as usuario_nombre
                FROM pagos_mensualidades p
                JOIN mensualidades m ON p.mensualidad_id = m.id
                JOIN tipos_vehiculos tv ON m.tipo_vehiculo_id = tv.id
                JOIN usuarios u ON p.usuario_id = u.id
                WHERE p.id = ?
            `, [id]);

            if (pago.length === 0) {
                return res.status(404).send('Ticket no encontrado');
            }

            // Formatear valores con separadores de miles
            const formatearNumero = (numero) => {
                return numero.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
            };

            res.render('mensualidades/ticket', {
                previsualizar: false,
                mensualidad: {
                    ...pago[0],
                    es_nueva: false
                },
                metodo_pago: pago[0].metodo_pago,
                referencia_pago: pago[0].referencia_pago,
                cantidad_meses: pago[0].cantidad_meses,
                valorTotal: formatearNumero(pago[0].valor_total),
                valorIva: formatearNumero(pago[0].valor_iva),
                valorSinIva: formatearNumero(pago[0].valor_total - pago[0].valor_iva),
                vigente_desde: new Date(pago[0].vigente_desde).toLocaleDateString('es-CO', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }),
                vigente_hasta: new Date(pago[0].vigente_hasta).toLocaleDateString('es-CO', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }),
                fechaActual: new Date(pago[0].fecha_pago).toLocaleDateString('es-CO', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }),
                usuario: {
                    nombre: pago[0].usuario_nombre
                }
            });
        } catch (error) {
            console.error('Error al ver ticket:', error);
            res.status(500).json({
                error: 'Error al ver ticket',
                details: error.message
            });
        }
    },

    // Procesar pago y renovar mensualidad
    procesarPagoYRenovar: async (req, res) => {
        const conn = await connection.getConnection();
        try {
            await conn.beginTransaction();

            const { id } = req.params;
            const { metodo_pago, referencia_pago, cantidad_meses, es_nueva } = req.body;
            const cantidadMeses = parseInt(cantidad_meses) || 1;

            let mensualidadBase;
            let vigente_desde, vigente_hasta;

            // Verificar si el vehículo está exento
            const placa = es_nueva === '1' ? req.body.placa : (await conn.query('SELECT placa FROM mensualidades WHERE id = ?', [id]))[0][0]?.placa;
            
            if (placa) {
                const [vehiculoExento] = await conn.query(`
                    SELECT * FROM vehiculos_exentos 
                    WHERE placa = ? 
                    AND estado = 1 
                    AND fecha_inicio <= CURDATE() 
                    AND fecha_fin >= CURDATE()
                `, [placa]);

                if (vehiculoExento.length > 0) {
                    await conn.rollback();
                    return res.status(400).send('Este vehículo está exento de pago hasta ' + 
                        new Date(vehiculoExento[0].fecha_fin).toLocaleDateString('es-CO', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        }));
                }
            }

            if (es_nueva === '1') {
                const [tipoVehiculo] = await conn.query(
                    'SELECT * FROM tipos_vehiculos WHERE id = ?',
                    [req.body.tipo_vehiculo_id]
                );

                if (!tipoVehiculo.length) {
                    throw new Error('Tipo de vehículo no encontrado');
                }

                vigente_desde = new Date();
                vigente_hasta = new Date(vigente_desde);
                vigente_hasta.setMonth(vigente_hasta.getMonth() + cantidadMeses);

                mensualidadBase = {
                    placa: req.body.placa,
                    nombre_dueno: req.body.nombre_dueno,
                    celular: req.body.celular,
                    email: req.body.email,
                    tipo_vehiculo_id: req.body.tipo_vehiculo_id,
                    tarifa_mensual: tipoVehiculo[0].tarifa_mensual,
                    porcentaje_iva: tipoVehiculo[0].porcentaje_iva
                };
            } else {
                const [mensualidad] = await conn.query(`
                    SELECT m.*, tv.tarifa_mensual, tv.porcentaje_iva
                    FROM mensualidades m 
                    JOIN tipos_vehiculos tv ON m.tipo_vehiculo_id = tv.id
                    WHERE m.id = ?
                `, [id]);

                if (!mensualidad.length) {
                    throw new Error('Mensualidad no encontrada');
                }

                mensualidadBase = mensualidad[0];

                // Calcular fechas de vigencia para renovación
                const fechaActual = new Date();
                const fechaVencimientoActual = new Date(mensualidad[0].vigente_hasta);

                // Si la mensualidad actual aún no ha vencido, la nueva vigencia comienza desde el vencimiento
                vigente_desde = fechaVencimientoActual > fechaActual ? 
                    new Date(fechaVencimientoActual) : new Date(fechaActual);

                vigente_hasta = new Date(vigente_desde);
                vigente_hasta.setMonth(vigente_hasta.getMonth() + cantidadMeses);
            }

            // Verificar si hay traslapes con otras mensualidades
            const [mensualidadesSolapadas] = await conn.query(`
                SELECT * FROM mensualidades 
                WHERE placa = ? 
                AND estado = 1
                ${!es_nueva ? 'AND id != ?' : ''}
                AND (
                    (vigente_desde <= ? AND vigente_hasta >= ?) OR
                    (vigente_desde <= ? AND vigente_hasta >= ?) OR
                    (vigente_desde >= ? AND vigente_hasta <= ?)
                )
            `, [
                mensualidadBase.placa,
                ...((!es_nueva ? [id] : [])),
                vigente_desde, vigente_desde,
                vigente_hasta, vigente_hasta,
                vigente_desde, vigente_hasta
            ]);

            if (mensualidadesSolapadas.length > 0) {
                throw new Error('Ya existe una mensualidad activa para este vehículo en el período seleccionado');
            }

            // Calcular valores totales
            const valorTotalMes = mensualidadBase.tarifa_mensual;
            const valorTotal = valorTotalMes * cantidadMeses;
            const valorSinIva = Math.round(valorTotal / (1 + (mensualidadBase.porcentaje_iva / 100)));
            const valorIva = valorTotal - valorSinIva;

            // Generar número de recibo si es pago en efectivo
            let referenciaFinal = referencia_pago;
            if (metodo_pago === 'efectivo') {
                const [ultimoRecibo] = await conn.query(
                    `SELECT MAX(CAST(SUBSTRING(referencia_pago, 2) AS UNSIGNED)) as ultimo_numero 
                     FROM pagos_mensualidades 
                     WHERE metodo_pago = 'efectivo' 
                     AND referencia_pago LIKE 'R%'`
                );
                
                const ultimoNumero = ultimoRecibo[0].ultimo_numero || 0;
                referenciaFinal = `R${String(ultimoNumero + 1).padStart(6, '0')}`;
            }

            // Primero crear la nueva mensualidad
            const [resultMensualidad] = await conn.query(
                `INSERT INTO mensualidades (
                    placa, nombre_dueno, celular, email,
                    fecha_pago, vigente_desde, vigente_hasta,
                    tipo_vehiculo_id, valor_total, valor_iva,
                    usuario_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    mensualidadBase.placa,
                    mensualidadBase.nombre_dueno,
                    mensualidadBase.celular,
                    mensualidadBase.email,
                    new Date(),
                    vigente_desde,
                    vigente_hasta,
                    mensualidadBase.tipo_vehiculo_id,
                    valorTotal,
                    valorIva,
                    req.session.usuario.id
                ]
            );

            // Luego crear el pago con la referencia a la mensualidad
            const [resultPago] = await conn.query(
                `INSERT INTO pagos_mensualidades (
                    mensualidad_id, valor_total, valor_iva, cantidad_meses,
                    metodo_pago, referencia_pago, usuario_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    resultMensualidad.insertId,
                    valorTotal,
                    valorIva,
                    cantidadMeses,
                    metodo_pago,
                    referenciaFinal,
                    req.session.usuario.id
                ]
            );

            // Finalmente, actualizar la mensualidad con la referencia al pago
            await conn.query(
                'UPDATE mensualidades SET pago_id = ? WHERE id = ?',
                [resultPago.insertId, resultMensualidad.insertId]
            );

            await conn.commit();
            res.redirect(`/mensualidades/ticket/${resultPago.insertId}`);
        } catch (error) {
            await conn.rollback();
            console.error('Error al procesar pago y renovar:', error);
            res.status(500).json({
                error: 'Error al procesar pago y renovar',
                details: error.message
            });
        } finally {
            conn.release();
        }
    },

    // Procesar pago de mensualidad
    procesarPago: async (req, res) => {
        const conn = await connection.getConnection();
        try {
            await conn.beginTransaction();

            const {
                es_nueva,
                placa,
                nombre_dueno,
                celular,
                email,
                documento_identidad,
                tipo_vehiculo_id,
                cantidad_meses,
                metodo_pago,
                referencia_pago
            } = req.body;

            let mensualidadId = req.params.id;
            let mensualidadBase;
            let vigente_desde;
            let vigente_hasta;

            // Validar datos requeridos
            if (!placa || !nombre_dueno || !celular || !email || !documento_identidad || !tipo_vehiculo_id || !cantidad_meses || !metodo_pago) {
                throw new Error('Faltan datos requeridos');
            }

            // Si es renovación, obtener datos de la mensualidad existente
            if (!es_nueva) {
                const [mensualidad] = await conn.query(
                    `SELECT m.*, tv.tarifa_mensual, tv.porcentaje_iva 
                     FROM mensualidades m
                     JOIN tipos_vehiculos tv ON m.tipo_vehiculo_id = tv.id
                     WHERE m.id = ?`,
                    [mensualidadId]
                );

                if (!mensualidad.length) {
                    throw new Error('Mensualidad no encontrada');
                }

                mensualidadBase = mensualidad[0];
                vigente_desde = new Date(mensualidadBase.vigente_hasta);
                vigente_hasta = new Date(vigente_desde);
                vigente_hasta.setMonth(vigente_hasta.getMonth() + parseInt(cantidad_meses));

                // Verificar si hay mensualidades solapadas
                const [mensualidadesSolapadas] = await conn.query(
                    `SELECT * FROM mensualidades 
                     WHERE placa = ? 
                     AND id != ? 
                     AND estado = 1
                     AND (
                         (vigente_desde <= ? AND vigente_hasta >= ?) OR
                         (vigente_desde <= ? AND vigente_hasta >= ?) OR
                         (vigente_desde >= ? AND vigente_hasta <= ?)
                     )`,
                    [
                        placa,
                        mensualidadId,
                        vigente_desde,
                        vigente_desde,
                        vigente_hasta,
                        vigente_hasta,
                        vigente_desde,
                        vigente_hasta
                    ]
                );

                if (mensualidadesSolapadas.length > 0) {
                    throw new Error('Ya existe una mensualidad activa para este vehículo en el período seleccionado');
                }
            } else {
                const [tipoVehiculo] = await conn.query(
                    'SELECT * FROM tipos_vehiculos WHERE id = ?',
                    [tipo_vehiculo_id]
                );

                if (!tipoVehiculo.length) {
                    throw new Error('Tipo de vehículo no encontrado');
                }

                vigente_desde = new Date();
                vigente_hasta = new Date(vigente_desde);
                vigente_hasta.setMonth(vigente_hasta.getMonth() + parseInt(cantidad_meses));

                mensualidadBase = {
                    placa,
                    nombre_dueno,
                    celular,
                    email,
                    tipo_vehiculo_id,
                    tarifa_mensual: tipoVehiculo[0].tarifa_mensual,
                    porcentaje_iva: tipoVehiculo[0].porcentaje_iva
                };
            }

            // Calcular valores
            const valorTotalMes = mensualidadBase.tarifa_mensual;
            const valorTotal = valorTotalMes * cantidad_meses;
            const valorSinIva = Math.round(valorTotal / (1 + (mensualidadBase.porcentaje_iva / 100)));
            const valorIva = valorTotal - valorSinIva;

            // Generar número de recibo si es pago en efectivo
            let referenciaFinal = referencia_pago;
            if (metodo_pago === 'efectivo') {
                const [ultimoRecibo] = await conn.query(
                    `SELECT MAX(CAST(SUBSTRING(referencia_pago, 2) AS UNSIGNED)) as ultimo_numero 
                     FROM pagos_mensualidades 
                     WHERE metodo_pago = 'efectivo' 
                     AND referencia_pago LIKE 'R%'`
                );
                
                const ultimoNumero = ultimoRecibo[0].ultimo_numero || 0;
                referenciaFinal = `R${String(ultimoNumero + 1).padStart(6, '0')}`;
            }

            if (es_nueva) {
                // Insertar nueva mensualidad
                const [result] = await conn.query(
                    `INSERT INTO mensualidades 
                     (placa, nombre_dueno, celular, email, tipo_vehiculo_id, estado, vigente_desde, vigente_hasta)
                     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
                    [placa, nombre_dueno, celular, email, tipo_vehiculo_id, vigente_desde, vigente_hasta]
                );
                mensualidadId = result.insertId;
            }

            // Registrar el pago
            const [resultPago] = await conn.query(
                `INSERT INTO pagos_mensualidades 
                 (mensualidad_id, fecha_pago, vigente_desde, vigente_hasta, cantidad_meses,
                  valor_total, valor_iva, metodo_pago, referencia_pago, usuario_id)
                 VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    mensualidadId,
                    vigente_desde,
                    vigente_hasta,
                    cantidad_meses,
                    valorTotal,
                    valorIva,
                    metodo_pago,
                    referenciaFinal,
                    req.session.usuario.id
                ]
            );

            // Registrar datos para factura electrónica
            await conn.query(
                `INSERT INTO cli_factura_e 
                 (movimiento_id, documento_identidad, nombre_completo, correo_electronico, numero_celular, tipo_movimiento)
                 VALUES (?, ?, ?, ?, ?, 'MENSUALIDAD')`,
                [resultPago.insertId, documento_identidad, nombre_dueno, email, celular]
            );

            // Actualizar estado y fechas de la mensualidad
            await conn.query(
                `UPDATE mensualidades 
                 SET estado = 1,
                     vigente_desde = ?,
                     vigente_hasta = ?
                 WHERE id = ?`,
                [vigente_desde, vigente_hasta, mensualidadId]
            );

            await conn.commit();
            res.redirect(`/mensualidades/ticket/${resultPago.insertId}`);
        } catch (error) {
            await conn.rollback();
            console.error('Error al procesar pago:', error);
            res.status(500).json({
                error: 'Error al procesar pago',
                details: error.message
            });
        } finally {
            conn.release();
        }
    }
};

module.exports = mensualidadesController; 