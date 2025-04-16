# Sistema de Gestión de Parqueadero

Sistema de gestión de parqueadero con módulo de usuarios desarrollado en Node.js, Express, Handlebars y MySQL.

## Requisitos Previos

- Node.js (v14 o superior)
- MySQL (v8 o superior)
- npm (v6 o superior)

## Instalación

1. Clonar el repositorio:
```bash
git clone [url-del-repositorio]
cd parqueadero
```

2. Instalar dependencias:
```bash
npm install
```

3. Configurar variables de entorno:
- Copiar el archivo `.env.example` a `.env`
- Modificar las variables según tu configuración local

4. Crear la base de datos:
- Ejecutar el script SQL en `database/schema.sql`

## Ejecución

1. Iniciar el servidor en modo desarrollo:
```bash
npm run dev
```

2. Iniciar el servidor en modo producción:
```bash
npm start
```

El servidor estará disponible en `http://localhost:3000`

## Estructura del Proyecto

```
parqueadero/
├── config/
│   └── database.js
├── controllers/
│   └── usuariosController.js
├── database/
│   └── schema.sql
├── routes/
│   └── usuarios.js
├── views/
│   ├── layouts/
│   │   └── main.handlebars
│   └── usuarios/
│       ├── lista.handlebars
│       ├── crear.handlebars
│       └── editar.handlebars
├── .env
├── app.js
└── package.json
```

## Funcionalidades

- Gestión de usuarios (CRUD)
- Roles de usuario (Administrador, Cajero)
- Interfaz responsive con Bootstrap 5 