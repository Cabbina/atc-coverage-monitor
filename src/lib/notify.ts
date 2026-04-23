import nodemailer from 'nodemailer'

const transport = nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: Number(process.env.EMAIL_SERVER_PORT),
    auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD,
    },
})

export async function sendAlertEmail({
    to,
    icao,
    callsign,
    positionType,
    network,
    event,
}: {
    to: string
    icao: string
    callsign: string
    positionType: string
    network: string
    event: 'online' | 'offline'
}) {
    const emoji = event === 'online' ? 'green' : 'red'
    const label = event === 'online' ? 'NOW ONLINE' : 'WENT OFFLINE'

    await transport.sendMail({
        to,
        from: process.env.EMAIL_FROM,
        subject: `ATC Alert: ${callsign} ${label}`,
        text: `${network} · ${icao} · ${positionType}\n\n${callsign} is ${label}.\n\nView live coverage: http://localhost:3000`,
        html: `
      <div style="font-family:monospace;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:${emoji === 'green' ? '#22c55e' : '#ef4444'}">
          ${callsign} ${label}
        </h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:4px 0;color:#888">Airport</td><td><strong>${icao}</strong></td></tr>
          <tr><td style="padding:4px 0;color:#888">Position</td><td>${positionType}</td></tr>
          <tr><td style="padding:4px 0;color:#888">Network</td><td>${network}</td></tr>
          <tr><td style="padding:4px 0;color:#888">Event</td><td>${label}</td></tr>
        </table>
        <p style="margin-top:24px">
          <a href="http://localhost:3000" style="color:#3b82f6">View live coverage</a>
        </p>
      </div>
    `,
    })
}