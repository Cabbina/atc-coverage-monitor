import postgres from 'postgres'

const connectionString = process.env.DATABASE_URL!

// Singleton connection
const sql = postgres(connectionString, {
    max: 10,
    idle_timeout: 30,
    connect_timeout: 10,
    ssl: 'require',
})

export default sql