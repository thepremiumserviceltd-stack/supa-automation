import { google } from "googleapis";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const CONFIG = {
  test_fr: {
    sheetId: process.env.SHEET_TEST_FR_ID,
    tabName: process.env.SHEET_TEST_FR_TAB,
    language: "fr",
    type: "test",
  },
  test_de: {
    sheetId: process.env.SHEET_TEST_DE_ID,
    tabName: process.env.SHEET_TEST_DE_TAB,
    language: "de",
    type: "test",
  },
  test_en: {
    sheetId: process.env.SHEET_TEST_EN_ID,
    tabName: process.env.SHEET_TEST_EN_TAB,
    language: "en",
    type: "test",
  },
  renewal: {
    sheetId: process.env.SHEET_RENEWAL_ID,
    tabName: process.env.SHEET_RENEWAL_TAB,
    language: "fr",
    type: "renewal",
  },
};

const MIN_DELAY_HOURS = 48;
const BATCH_SIZE = 5;

function getGoogleAuth() {
  return new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    ["https://www.googleapis.com/auth/spreadsheets"]
  );
}

function hoursSince(dateString) {
  if (!dateString) return Infinity;
  const sentAt = new Date(dateString).getTime();
  if (Number.isNaN(sentAt)) return Infinity;
  return (Date.now() - sentAt) / (1000 * 60 * 60);
}
function buildEmail(title, content, buttonText = "Activer mon accès") {
  return `
    <div style="font-family: Arial, sans-serif; background:#f5f5f5; padding:20px;">
      <div style="max-width:600px; margin:auto; background:white; padding:25px; border-radius:8px;">
        
        <h2 style="color:#111; margin-top:0;">${title}</h2>

        <div style="color:#333; line-height:1.7; font-size:15px;">
          ${content}
        </div>

        <div style="text-align:center; margin:30px 0;">
          <a href="https://supa-services.com/pricing" 
             style="background:#111; color:white; padding:14px 24px; text-decoration:none; border-radius:5px; display:inline-block;">
             ${buttonText}
          </a>
        </div>

        <div style="text-align:center; margin-bottom:20px;">
          <a href="https://wa.me/447577327132" 
             style="color:#25D366; font-weight:bold; text-decoration:none;">
             Assistance WhatsApp
          </a>
        </div>

        <hr style="margin:30px 0; border:none; border-top:1px solid #ddd;">

        <p style="font-size:12px; color:#777; margin:0;">
          SupaService<br>
          <a href="https://supa-services.com" style="color:#777;">https://supa-services.com</a><br>
          WhatsApp assistance: <a href="https://wa.me/447577327132" style="color:#777;">+44 7577 327132</a>
        </p>
      </div>
    </div>
  `;
}
function getTemplate(language, type, step) {
  const templates = {
    fr: {
      test: [
        {
          subject: "SUPA FR test - étape 1",
          html: `<p>Email de test FR - étape 1.</p>`,
        },
        {
          subject: "SUPA FR test - étape 2",
          html: `<p>Email de test FR - étape 2.</p>`,
        },
        {
          subject: "SUPA FR test - étape 3",
          html: `<p>Email de test FR - étape 3.</p>`,
        },
        {
          subject: "SUPA FR test - étape 4",
          html: `<p>Email de test FR - étape 4.</p>`,
        },
      ],
      renewal: [
        {
          subject: "SUPA renewal FR - étape 1",
          html: `<p>Email de test renewal FR - étape 1.</p>`,
        },
        {
          subject: "SUPA renewal FR - étape 2",
          html: `<p>Email de test renewal FR - étape 2.</p>`,
        },
        {
          subject: "SUPA renewal FR - étape 3",
          html: `<p>Email de test renewal FR - étape 3.</p>`,
        },
        {
          subject: "SUPA renewal FR - étape 4",
          html: `<p>Email de test renewal FR - étape 4.</p>`,
        },
      ],
    },
    de: {
      test: [
        {
          subject: "SUPA DE Test - Schritt 1",
          html: `<p>DE Test-E-Mail - Schritt 1.</p>`,
        },
        {
          subject: "SUPA DE Test - Schritt 2",
          html: `<p>DE Test-E-Mail - Schritt 2.</p>`,
        },
        {
          subject: "SUPA DE Test - Schritt 3",
          html: `<p>DE Test-E-Mail - Schritt 3.</p>`,
        },
        {
          subject: "SUPA DE Test - Schritt 4",
          html: `<p>DE Test-E-Mail - Schritt 4.</p>`,
        },
      ],
    },
    en: {
      test: [
        {
          subject: "SUPA EN test - step 1",
          html: `<p>EN test email - step 1.</p>`,
        },
        {
          subject: "SUPA EN test - step 2",
          html: `<p>EN test email - step 2.</p>`,
        },
        {
          subject: "SUPA EN test - step 3",
          html: `<p>EN test email - step 3.</p>`,
        },
        {
          subject: "SUPA EN test - step 4",
          html: `<p>EN test email - step 4.</p>`,
        },
      ],
    },
  };

  const list = templates[language]?.[type];
  if (!list) {
    return {
      subject: `SUPA automation - ${language} - ${type}`,
      html: `<p>Fallback template</p>`,
    };
  }

  return list[Math.min(step, list.length - 1)];
}

export default async function handler(req, res) {
  try {
    const audience = req.query.audience;

    if (!audience || !CONFIG[audience]) {
      return res.status(400).json({
        error: "Use ?audience=test_fr, test_de, test_en or renewal",
      });
    }

    const { sheetId, tabName, language, type } = CONFIG[audience];

    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: "v4", auth });

    const range = `${tabName}!A:G`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range,
    });

    const rows = response.data.values || [];
    if (rows.length < 2) {
      return res.status(200).json({
        success: true,
        sent: 0,
        message: "No data rows found",
      });
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    const records = dataRows.map((row, index) => {
      const obj = {};
      headers.forEach((header, i) => {
        obj[header] = row[i] || "";
      });
      obj._rowNumber = index + 2;
      return obj;
    });

    const eligible = records.filter((r) => {
      const isActive = r.status === "active";
      const notPurchased = r.purchased !== "done" && r.purchased !== "bought";
      const enoughDelay = hoursSince(r.last_sent_at) >= MIN_DELAY_HOURS;
      return r.email && isActive && notPurchased && enoughDelay;
    });

    const toSend = eligible.slice(0, BATCH_SIZE);

    if (toSend.length === 0) {
      return res.status(200).json({
        success: true,
        sent: 0,
        message: "No eligible contacts",
      });
    }

    const emails = toSend.map((contact) => {
      const step = Number(contact.step || 0);
      const tpl = getTemplate(contact.language || language, type, step);

      return {
        from: "SUPA <contact@supa-services.com>",
        to: contact.email,
        subject: tpl.subject,
        html: tpl.html,
      };
    });

    const result = await resend.batch.send(emails);
    const now = new Date().toISOString();

    for (const contact of toSend) {
      const rowNumber = contact._rowNumber;
      const newStep = Number(contact.step || 0) + 1;

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${tabName}!D${rowNumber}:E${rowNumber}`,
        valueInputOption: "RAW",
        requestBody: {
          values: [[newStep, now]],
        },
      });
    }

    return res.status(200).json({
      success: true,
      audience,
      sent: toSend.length,
      skipped: records.length - toSend.length,
      result,
    });
  } catch (error) {
    console.error("Automation error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
