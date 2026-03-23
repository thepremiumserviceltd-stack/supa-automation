import { google } from "googleapis";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const CONFIG = {
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

function getGoogleAuth() {
  return new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    ["https://www.googleapis.com/auth/spreadsheets"]
  );
}

function getTemplate(language, type, step) {
  const templates = {
    en: {
      test: [
        {
          subject: "SUPA test automation - step 1",
          html: `<p>This is a test email for SUPA test audience - step 1.</p>`,
        },
        {
          subject: "SUPA test automation - step 2",
          html: `<p>This is a test email for SUPA test audience - step 2.</p>`,
        },
      ],
    },
    fr: {
      renewal: [
        {
          subject: "SUPA renewal automation - étape 1",
          html: `<p>Ceci est un email de test pour l’audience renouvellement - étape 1.</p>`,
        },
        {
          subject: "SUPA renewal automation - étape 2",
          html: `<p>Ceci est un email de test pour l’audience renouvellement - étape 2.</p>`,
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
        error: "Use ?audience=test_en or ?audience=renewal",
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
      return res.status(200).json({ success: true, sent: 0, message: "No data rows found" });
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
      return (
        r.email &&
        r.status === "active" &&
        r.purchased !== "done" &&
        r.purchased !== "bought"
      );
    });

    const batchSize = 5;
    const toSend = eligible.slice(0, batchSize);

    if (toSend.length === 0) {
      return res.status(200).json({ success: true, sent: 0, message: "No eligible contacts" });
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
