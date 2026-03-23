import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  try {
    const emails = [
      "thepremiumserviceltd@gmail.com"
    ];

    for (const email of emails) {
      await resend.emails.send({
        from: "SUPA <contact@supa-services.com>",
        to: email,
        subject: "Test automatique SUPA",
        html: `
          <div style="font-family: Arial, sans-serif;">
            <h2>Test SUPA 🔥</h2>
            <p>Ton système d'automatisation fonctionne correctement.</p>
            <p>Prochaine étape : envoyer à toute ta base.</p>
          </div>
        `
      });
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}