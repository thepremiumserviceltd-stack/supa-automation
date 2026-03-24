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
const BATCH_SIZE = 5; // augmente plus tard à 20, puis 50, puis 100

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

function buildEmail(title, preview, content, buttonText = "Activer mon accès") {
  return `
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">
      ${preview}
    </div>

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
          subject: "Votre accès SUPA est prêt à être activé",
          html: buildEmail(
            "Votre accès SUPA est prêt à être activé",
            "Vous avez testé — il ne reste plus qu’à en profiter pleinement.",
            `
            <p>Bonjour,</p>
            <p>Vous avez récemment testé SUPA, et vous avez pu voir par vous-même comment tout fonctionne.</p>
            <p>Aujourd’hui, tout est prêt pour passer à l’étape suivante et profiter pleinement de votre accès.</p>
            <p>Avec SUPA, vous avez accès à :</p>
            <ul>
              <li>⚽ Les grands matchs et la Champions League</li>
              <li>🎬 Films et séries en continu</li>
              <li>📺 Toutes les chaînes (France, Allemagne, international)</li>
              <li>📱 Utilisation sur mobile, TV et ordinateur (jusqu’à 4 appareils)</li>
            </ul>
            <p>Votre accès peut être activé dès maintenant avec une condition simple :</p>
            <p><strong>30 € au lieu de 45 € avec le code SAVE15</strong></p>
            <p>Si vous avez la moindre question ou besoin d’assistance, nous sommes disponibles directement sur WhatsApp.</p>
            `
          )
        },
        {
          subject: "Votre accès SUPA est toujours disponible",
          html: buildEmail(
            "Votre accès SUPA est toujours disponible",
            "Votre accès est prêt, vous pouvez passer à l’activation dès maintenant.",
            `
            <p>Bonjour,</p>
            <p>Vous avez déjà testé SUPA, vous savez donc que la plateforme fonctionne et que tout est prêt.</p>
            <p>En activant votre accès, vous profitez de :</p>
            <ul>
              <li>⚽ Matchs en direct</li>
              <li>🎬 Films et séries</li>
              <li>📺 Chaînes internationales</li>
              <li>📱 Utilisation sur plusieurs appareils</li>
            </ul>
            <p>Votre accès reste disponible à <strong>30 € au lieu de 45 €</strong> avec le code <strong>SAVE15</strong>.</p>
            `
          )
        },
        {
          subject: "Les grands matchs arrivent cette semaine",
          html: buildEmail(
            "Les grands matchs arrivent cette semaine",
            "Votre accès SUPA est prêt, il ne reste qu’à l’activer.",
            `
            <p>Bonjour,</p>
            <p>Les prochains jours s’annoncent chargés avec les grands matchs et les meilleures affiches.</p>
            <p>Vous avez déjà testé SUPA, donc vous savez exactement ce que vous pouvez regarder :</p>
            <ul>
              <li>⚽ Les matchs en direct</li>
              <li>🎬 Films et séries en continu</li>
              <li>📺 Toutes les chaînes internationales</li>
              <li>📱 Accès sur tous vos appareils</li>
            </ul>
            <p>Votre accès est toujours disponible à des conditions avantageuses :</p>
            <p><strong>30 € au lieu de 45 € avec le code SAVE15</strong></p>
            <p>Besoin d’aide ou d’une activation rapide ? Notre support est disponible directement sur WhatsApp.</p>
            `
          )
        },
        {
          subject: "Votre accès est prêt — activation en 1 minute",
          html: buildEmail(
            "Votre accès est prêt — activation en 1 minute",
            "Tout est déjà configuré, il ne reste qu’un clic.",
            `
            <p>Bonjour,</p>
            <p>Votre accès SUPA est déjà prêt.</p>
            <p>Après votre test, tout est configuré pour que vous puissiez commencer immédiatement.</p>
            <p>Avec SUPA, vous avez accès à :</p>
            <ul>
              <li>⚽ Tous les grands matchs</li>
              <li>🎬 Films et séries</li>
              <li>📺 Chaînes internationales</li>
              <li>📱 Utilisation sur plusieurs appareils</li>
            </ul>
            <p>Activation simple et immédiate :</p>
            <p><strong>30 € avec le code SAVE15</strong></p>
            <p>Si vous préférez passer directement par un conseiller, notre support WhatsApp est disponible.</p>
            `
          )
        },
        {
          subject: "Profitez de SUPA sur tous vos écrans",
          html: buildEmail(
            "Profitez de SUPA sur tous vos écrans",
            "Un seul accès, plusieurs appareils.",
            `
            <p>Bonjour,</p>
            <p>Avec SUPA, vous n’êtes pas limité à un seul écran.</p>
            <p>Vous pouvez profiter de votre accès sur :</p>
            <ul>
              <li>📱 Smartphone</li>
              <li>💻 Ordinateur</li>
              <li>📺 Télévision</li>
            </ul>
            <p>Et même utiliser plusieurs appareils selon la formule choisie.</p>
            <p>Tout est déjà prêt, puisque vous avez testé la plateforme.</p>
            <p><strong>30 € au lieu de 45 € avec SAVE15</strong></p>
            `
          )
        },
        {
          subject: "Tout ce que vous pouvez regarder avec SUPA",
          html: buildEmail(
            "Tout ce que vous pouvez regarder avec SUPA",
            "Bien plus que les matchs.",
            `
            <p>Bonjour,</p>
            <p>SUPA, ce n’est pas seulement le sport.</p>
            <p>Vous avez accès à :</p>
            <ul>
              <li>⚽ Matchs en direct</li>
              <li>🎬 Films récents</li>
              <li>📺 Séries</li>
              <li>🌍 Chaînes internationales</li>
            </ul>
            <p>Tout dans un seul accès.</p>
            <p>Vous avez déjà testé, donc vous savez que ça fonctionne.</p>
            <p><strong>30 € avec SAVE15</strong></p>
            `
          )
        },
        {
          subject: "Les prochains jours vont être chargés",
          html: buildEmail(
            "Les prochains jours vont être chargés",
            "Ne ratez pas les meilleures affiches.",
            `
            <p>Bonjour,</p>
            <p>Les prochains jours s’annoncent riches en contenu.</p>
            <ul>
              <li>👉 Grands matchs</li>
              <li>👉 Nouveaux films</li>
              <li>👉 Séries en continu</li>
            </ul>
            <p>Votre accès SUPA vous permet de tout regarder, sans limite.</p>
            <p>Tout est déjà prêt.</p>
            <p>Il ne manque que l’activation.</p>
            <p><strong>30 € avec le code SAVE15</strong></p>
            `
          )
        },
        {
          subject: "Votre accès est toujours disponible",
          html: buildEmail(
            "Votre accès est toujours disponible",
            "Conditions actuelles maintenues.",
            `
            <p>Bonjour,</p>
            <p>Votre accès SUPA est toujours disponible.</p>
            <p>Les conditions actuelles sont maintenues pour le moment :</p>
            <p><strong>30 € au lieu de 45 € avec SAVE15</strong></p>
            <p>Vous avez déjà testé la plateforme.</p>
            <p>Vous pouvez activer votre accès en quelques secondes.</p>
            `
          )
        },
        {
          subject: "Vous pouvez commencer aujourd’hui",
          html: buildEmail(
            "Vous pouvez commencer aujourd’hui",
            "Activation immédiate.",
            `
            <p>Bonjour,</p>
            <p>Votre accès SUPA peut être activé immédiatement.</p>
            <p>Aucune attente.</p>
            <p>Dès l’activation, vous pouvez :</p>
            <ul>
              <li>regarder les matchs</li>
              <li>accéder aux films</li>
              <li>profiter des chaînes</li>
            </ul>
            <p><strong>30 € avec le code SAVE15</strong></p>
            `
          )
        },
        {
          subject: "Encore disponible à 30 €",
          html: buildEmail(
            "Encore disponible à 30 €",
            "L’offre est toujours active.",
            `
            <p>Bonjour,</p>
            <p>L’accès SUPA est toujours disponible à :</p>
            <p><strong>30 € avec SAVE15</strong></p>
            <p>Mais cette condition ne restera pas indéfiniment.</p>
            <p>Vous avez déjà testé.</p>
            <p>Vous savez que tout fonctionne.</p>
            `
          )
        },
        {
          subject: "Ne ratez pas les prochains événements",
          html: buildEmail(
            "Ne ratez pas les prochains événements",
            "Les contenus arrivent.",
            `
            <p>Bonjour,</p>
            <p>De nouveaux contenus arrivent chaque semaine.</p>
            <ul>
              <li>👉 Matchs</li>
              <li>👉 Films</li>
              <li>👉 Séries</li>
            </ul>
            <p>Votre accès SUPA vous permet de tout suivre.</p>
            <p><strong>30 € au lieu de 45 € avec le code SAVE15</strong></p>
            `
          )
        },
        {
          subject: "Dernière opportunité",
          html: buildEmail(
            "Dernière opportunité",
            "Après cela, les conditions peuvent changer.",
            `
            <p>Bonjour,</p>
            <p>Ceci est un dernier message.</p>
            <p>Votre accès SUPA n’est toujours pas activé.</p>
            <p><strong>Soit vous activez maintenant, soit vous passez à côté.</strong></p>
            <p><strong>30 € avec SAVE15</strong></p>
            <p>Si vous avez besoin d’aide, notre assistance WhatsApp est disponible.</p>
            `
          )
        }
      ],

      renewal: [
        {
          subject: "Votre accès SUPA peut être renouvelé",
          html: buildEmail(
            "Votre accès SUPA peut être renouvelé",
            "Reprenez votre accès dès maintenant.",
            `
            <p>Bonjour,</p>
            <p>Vous avez déjà utilisé SUPA auparavant.</p>
            <p>Si vous souhaitez reprendre l’accès, le renouvellement est disponible dès maintenant avec un avantage simple :</p>
            <p><strong>30 € au lieu de 45 € avec le code SAVE15</strong></p>
            <p>SUPA reste disponible sur téléphone, ordinateur et télévision.</p>
            `
          )
        },
        {
          subject: "Reprenez votre accès SUPA simplement",
          html: buildEmail(
            "Reprenez votre accès SUPA simplement",
            "Votre renouvellement est disponible.",
            `
            <p>Bonjour,</p>
            <p>Votre accès SUPA peut être réactivé en quelques instants.</p>
            <p>Vous retrouvez :</p>
            <ul>
              <li>⚽ Les matchs</li>
              <li>🎬 Films et séries</li>
              <li>📺 Les chaînes internationales</li>
            </ul>
            <p><strong>30 € avec le code SAVE15</strong></p>
            `
          )
        },
        {
          subject: "Votre renouvellement SUPA est toujours disponible",
          html: buildEmail(
            "Votre renouvellement SUPA est toujours disponible",
            "Vos conditions actuelles sont maintenues.",
            `
            <p>Bonjour,</p>
            <p>Nous vous rappelons que votre renouvellement est toujours possible.</p>
            <p>Vous pouvez reprendre votre accès avec les conditions actuelles :</p>
            <p><strong>30 € au lieu de 45 € avec SAVE15</strong></p>
            `
          )
        },
        {
          subject: "Continuez avec SUPA",
          html: buildEmail(
            "Continuez avec SUPA",
            "Reprenez vos contenus sans interruption.",
            `
            <p>Bonjour,</p>
            <p>Si vous souhaitez retrouver vos contenus, votre renouvellement est prêt.</p>
            <p>SUPA vous permet de continuer à profiter :</p>
            <ul>
              <li>⚽ Des grands matchs</li>
              <li>🎬 Des films et séries</li>
              <li>📺 Des chaînes du monde entier</li>
            </ul>
            <p><strong>30 € avec SAVE15</strong></p>
            `
          )
        },
        {
          subject: "Votre accès peut être réactivé aujourd’hui",
          html: buildEmail(
            "Votre accès peut être réactivé aujourd’hui",
            "Réactivation simple et rapide.",
            `
            <p>Bonjour,</p>
            <p>Votre accès SUPA peut être réactivé dès aujourd’hui.</p>
            <p>Aucune attente, aucune complication.</p>
            <p>Vous pouvez retrouver votre accès complet pour :</p>
            <p><strong>30 € au lieu de 45 € avec le code SAVE15</strong></p>
            `
          )
        },
        {
          subject: "Revenez sur SUPA à vos conditions",
          html: buildEmail(
            "Revenez sur SUPA à vos conditions",
            "Votre retour est toujours possible.",
            `
            <p>Bonjour,</p>
            <p>Nous vous écrivons pour vous rappeler que votre retour sur SUPA est toujours possible.</p>
            <p>Vous connaissez déjà la plateforme, il ne reste plus qu’à relancer votre accès.</p>
            <p><strong>30 € avec le code SAVE15</strong></p>
            `
          )
        },
        {
          subject: "Retrouvez vos matchs, films et séries",
          html: buildEmail(
            "Retrouvez vos matchs, films et séries",
            "Votre renouvellement est à portée de clic.",
            `
            <p>Bonjour,</p>
            <p>Avec SUPA, vous pouvez retrouver immédiatement :</p>
            <ul>
              <li>⚽ Les matchs</li>
              <li>🎬 Les films</li>
              <li>📺 Les séries et chaînes</li>
            </ul>
            <p>Il vous suffit de renouveler votre accès.</p>
            <p><strong>30 € au lieu de 45 € avec SAVE15</strong></p>
            `
          )
        },
        {
          subject: "Votre accès SUPA reste disponible",
          html: buildEmail(
            "Votre accès SUPA reste disponible",
            "Vos conditions de renouvellement sont maintenues.",
            `
            <p>Bonjour,</p>
            <p>Votre accès SUPA reste disponible au renouvellement.</p>
            <p>Si vous souhaitez reprendre votre accès, les conditions actuelles restent ouvertes pour le moment.</p>
            <p><strong>30 € avec SAVE15</strong></p>
            `
          )
        },
        {
          subject: "Reprenez votre accès en quelques secondes",
          html: buildEmail(
            "Reprenez votre accès en quelques secondes",
            "Votre retour sur SUPA est simple.",
            `
            <p>Bonjour,</p>
            <p>Vous pouvez reprendre votre accès SUPA en quelques secondes seulement.</p>
            <p>Une fois activé, vous retrouvez l’ensemble de vos contenus sur vos appareils.</p>
            <p><strong>30 € au lieu de 45 € avec SAVE15</strong></p>
            `
          )
        },
        {
          subject: "Encore disponible pour votre renouvellement",
          html: buildEmail(
            "Encore disponible pour votre renouvellement",
            "Votre accès n’attend plus que vous.",
            `
            <p>Bonjour,</p>
            <p>Votre renouvellement est encore disponible.</p>
            <p>Vous connaissez déjà SUPA. Si vous souhaitez revenir, tout est prêt.</p>
            <p><strong>30 € avec le code SAVE15</strong></p>
            `
          )
        },
        {
          subject: "Ne perdez pas votre avantage de renouvellement",
          html: buildEmail(
            "Ne perdez pas votre avantage de renouvellement",
            "Votre code SAVE15 reste disponible.",
            `
            <p>Bonjour,</p>
            <p>Votre avantage de renouvellement est toujours en place pour le moment.</p>
            <p>Vous pouvez encore reprendre votre accès avec :</p>
            <p><strong>30 € au lieu de 45 € avec SAVE15</strong></p>
            `
          )
        },
        {
          subject: "Dernier rappel pour votre renouvellement SUPA",
          html: buildEmail(
            "Dernier rappel pour votre renouvellement SUPA",
            "Dernière relance avant changement de conditions.",
            `
            <p>Bonjour,</p>
            <p>Ceci est un dernier rappel pour reprendre votre accès SUPA.</p>
            <p>Si vous souhaitez retrouver vos contenus, vous pouvez encore activer avec le code <strong>SAVE15</strong>.</p>
            <p><strong>30 € au lieu de 45 €.</strong></p>
            `
          )
        }
      ]
    },

    de: {
      test: [
        {
          subject: "Ihr SUPA Zugang ist bereit",
          html: buildEmail(
            "Ihr SUPA Zugang ist bereit",
            "Sie haben getestet — jetzt können Sie aktivieren.",
            `
            <p>Hallo,</p>
            <p>Sie haben SUPA bereits getestet und gesehen, wie alles funktioniert.</p>
            <p>Jetzt können Sie Ihren Zugang aktivieren und Folgendes genießen:</p>
            <ul>
              <li>⚽ Große Spiele und Champions League</li>
              <li>🎬 Filme und Serien</li>
              <li>📺 Internationale Sender</li>
              <li>📱 Smartphone, Computer und Fernseher</li>
            </ul>
            <p><strong>30 € statt 45 €</strong> mit dem Code <strong>SAVE15</strong>.</p>
            `,
            "Zugang aktivieren"
          )
        },
        {
          subject: "Ihr SUPA Zugang kann jetzt aktiviert werden",
          html: buildEmail(
            "Ihr SUPA Zugang kann jetzt aktiviert werden",
            "Alles ist bereit für Ihren Zugang.",
            `
            <p>Hallo,</p>
            <p>Sie haben SUPA bereits getestet und wissen, dass alles funktioniert.</p>
            <p>Jetzt können Sie Ihren Zugang aktivieren und Ihre Inhalte jederzeit genießen.</p>
            <p><strong>30 € mit SAVE15</strong></p>
            `,
            "Zugang aktivieren"
          )
        },
        {
          subject: "Die großen Spiele kommen",
          html: buildEmail(
            "Die großen Spiele kommen",
            "Ihr Zugang ist bereit.",
            `
            <p>Hallo,</p>
            <p>Die nächsten Tage bringen große Spiele und Top-Highlights.</p>
            <p>Mit SUPA können Sie ansehen:</p>
            <ul>
              <li>⚽ Live-Spiele</li>
              <li>🎬 Filme und Serien</li>
              <li>📺 Internationale Sender</li>
            </ul>
            <p><strong>30 € statt 45 € mit SAVE15</strong></p>
            `,
            "Zugang aktivieren"
          )
        },
        {
          subject: "Ihr Zugang kann sofort aktiviert werden",
          html: buildEmail(
            "Ihr Zugang kann sofort aktiviert werden",
            "Nur noch ein Schritt.",
            `
            <p>Hallo,</p>
            <p>Nach Ihrem Test ist alles bereit.</p>
            <p>Aktivieren Sie Ihren Zugang und schauen Sie direkt auf mehreren Geräten.</p>
            <p><strong>30 € mit SAVE15</strong></p>
            `,
            "Jetzt aktivieren"
          )
        },
        {
          subject: "SUPA auf all Ihren Geräten",
          html: buildEmail(
            "SUPA auf all Ihren Geräten",
            "Ein Zugang, mehrere Bildschirme.",
            `
            <p>Hallo,</p>
            <p>Mit SUPA sind Sie nicht auf ein einziges Gerät beschränkt.</p>
            <p>Sie können Ihren Zugang nutzen auf:</p>
            <ul>
              <li>📱 Smartphone</li>
              <li>💻 Computer</li>
              <li>📺 Fernseher</li>
            </ul>
            <p><strong>30 € statt 45 € mit dem Code SAVE15</strong></p>
            `,
            "Jetzt aktivieren"
          )
        },
        {
          subject: "Mehr als nur Sport",
          html: buildEmail(
            "Mehr als nur Sport",
            "Mit SUPA sehen Sie viel mehr.",
            `
            <p>Hallo,</p>
            <p>SUPA bietet nicht nur Sport.</p>
            <p>Sie erhalten Zugang zu:</p>
            <ul>
              <li>⚽ Spielen</li>
              <li>🎬 Filmen</li>
              <li>📺 Serien und internationalen Sendern</li>
            </ul>
            <p><strong>30 € mit SAVE15</strong></p>
            `,
            "Jetzt aktivieren"
          )
        },
        {
          subject: "Die nächsten Tage lohnen sich",
          html: buildEmail(
            "Die nächsten Tage lohnen sich",
            "Verpassen Sie keine Highlights.",
            `
            <p>Hallo,</p>
            <p>In den nächsten Tagen warten viele Inhalte auf Sie:</p>
            <ul>
              <li>👉 Große Spiele</li>
              <li>👉 Neue Filme</li>
              <li>👉 Serien</li>
            </ul>
            <p>Ihr Zugang ist bereit. Es fehlt nur noch die Aktivierung.</p>
            <p><strong>30 € mit SAVE15</strong></p>
            `,
            "Jetzt aktivieren"
          )
        },
        {
          subject: "Ihr Zugang ist weiterhin verfügbar",
          html: buildEmail(
            "Ihr Zugang ist weiterhin verfügbar",
            "Ihre aktuellen Konditionen bleiben vorerst bestehen.",
            `
            <p>Hallo,</p>
            <p>Ihr SUPA Zugang ist weiterhin verfügbar.</p>
            <p>Aktuell gilt noch:</p>
            <p><strong>30 € statt 45 € mit SAVE15</strong></p>
            `,
            "Zugang aktivieren"
          )
        },
        {
          subject: "Sie können heute starten",
          html: buildEmail(
            "Sie können heute starten",
            "Aktivierung sofort möglich.",
            `
            <p>Hallo,</p>
            <p>Ihr Zugang kann sofort aktiviert werden.</p>
            <p>Direkt nach der Aktivierung können Sie Spiele, Filme und Sender ansehen.</p>
            <p><strong>30 € mit dem Code SAVE15</strong></p>
            `,
            "Jetzt starten"
          )
        },
        {
          subject: "Noch immer für 30 € verfügbar",
          html: buildEmail(
            "Noch immer für 30 € verfügbar",
            "Ihr Vorteil ist noch aktiv.",
            `
            <p>Hallo,</p>
            <p>SUPA ist aktuell noch für <strong>30 €</strong> verfügbar.</p>
            <p>Sie haben bereits getestet. Jetzt fehlt nur noch die Aktivierung.</p>
            `,
            "Jetzt aktivieren"
          )
        },
        {
          subject: "Verpassen Sie die nächsten Events nicht",
          html: buildEmail(
            "Verpassen Sie die nächsten Events nicht",
            "Spiele, Filme und mehr warten auf Sie.",
            `
            <p>Hallo,</p>
            <p>Jede Woche kommen neue Inhalte:</p>
            <ul>
              <li>👉 Spiele</li>
              <li>👉 Filme</li>
              <li>👉 Serien</li>
            </ul>
            <p><strong>30 € statt 45 € mit SAVE15</strong></p>
            `,
            "Jetzt aktivieren"
          )
        },
        {
          subject: "Letzte Erinnerung",
          html: buildEmail(
            "Letzte Erinnerung",
            "Danach können sich die Bedingungen ändern.",
            `
            <p>Hallo,</p>
            <p>Dies ist eine letzte Erinnerung für Ihren SUPA Zugang.</p>
            <p>Sie haben getestet, jetzt müssen Sie nur noch aktivieren.</p>
            <p><strong>30 € statt 45 € mit SAVE15</strong></p>
            `,
            "Jetzt aktivieren"
          )
        }
      ]
    },

    en: {
      test: [
        {
          subject: "Your SUPA access is ready",
          html: buildEmail(
            "Your SUPA access is ready",
            "You tested it — now you can activate it.",
            `
            <p>Hello,</p>
            <p>You already tested SUPA and saw how everything works.</p>
            <p>You can now activate your access and enjoy:</p>
            <ul>
              <li>⚽ Big matches and Champions League</li>
              <li>🎬 Movies and series</li>
              <li>📺 International channels</li>
              <li>📱 Mobile, computer and TV</li>
            </ul>
            <p><strong>€30 instead of €45</strong> with code <strong>SAVE15</strong>.</p>
            `,
            "Activate my access"
          )
        },
        {
          subject: "Your SUPA access is still available",
          html: buildEmail(
            "Your SUPA access is still available",
            "Everything is ready for activation.",
            `
            <p>Hello,</p>
            <p>You already tested SUPA, so you know the platform works.</p>
            <p>You can now activate and enjoy sports, movies, series and channels on your devices.</p>
            <p><strong>€30 with SAVE15</strong></p>
            `,
            "Activate my access"
          )
        },
        {
          subject: "Big matches are coming",
          html: buildEmail(
            "Big matches are coming",
            "Your access is ready.",
            `
            <p>Hello,</p>
            <p>The next days are full of great content and big matches.</p>
            <p>You already tested SUPA, so you know what is available:</p>
            <ul>
              <li>⚽ Live matches</li>
              <li>🎬 Movies and series</li>
              <li>📺 International channels</li>
            </ul>
            <p><strong>€30 instead of €45 with SAVE15</strong></p>
            `,
            "Activate my access"
          )
        },
        {
          subject: "Activation takes 1 minute",
          html: buildEmail(
            "Activation takes 1 minute",
            "Only one step left.",
            `
            <p>Hello,</p>
            <p>Your SUPA access is ready.</p>
            <p>Activate now and start watching immediately on your devices.</p>
            <p><strong>€30 with code SAVE15</strong></p>
            `,
            "Activate now"
          )
        },
        {
          subject: "SUPA on all your screens",
          html: buildEmail(
            "SUPA on all your screens",
            "One access, multiple devices.",
            `
            <p>Hello,</p>
            <p>With SUPA, you are not limited to one screen.</p>
            <p>You can use your access on:</p>
            <ul>
              <li>📱 Mobile</li>
              <li>💻 Computer</li>
              <li>📺 TV</li>
            </ul>
            <p><strong>€30 instead of €45 with SAVE15</strong></p>
            `,
            "Activate now"
          )
        },
        {
          subject: "More than just sports",
          html: buildEmail(
            "More than just sports",
            "SUPA gives you much more.",
            `
            <p>Hello,</p>
            <p>SUPA is not only about sports.</p>
            <p>You also get access to:</p>
            <ul>
              <li>🎬 Movies</li>
              <li>📺 Series</li>
              <li>🌍 International channels</li>
            </ul>
            <p><strong>€30 with SAVE15</strong></p>
            `,
            "Activate now"
          )
        },
        {
          subject: "The next days are packed",
          html: buildEmail(
            "The next days are packed",
            "Do not miss the top content.",
            `
            <p>Hello,</p>
            <p>The next days are full of content:</p>
            <ul>
              <li>👉 Big matches</li>
              <li>👉 New movies</li>
              <li>👉 Series</li>
            </ul>
            <p>Your SUPA access is ready. You only need to activate it.</p>
            <p><strong>€30 with SAVE15</strong></p>
            `,
            "Activate now"
          )
        },
        {
          subject: "Your access is still available",
          html: buildEmail(
            "Your access is still available",
            "Current conditions remain available.",
            `
            <p>Hello,</p>
            <p>Your SUPA access is still available.</p>
            <p>Current activation remains:</p>
            <p><strong>€30 instead of €45 with SAVE15</strong></p>
            `,
            "Activate now"
          )
        },
        {
          subject: "You can start today",
          html: buildEmail(
            "You can start today",
            "Immediate activation.",
            `
            <p>Hello,</p>
            <p>Your SUPA access can be activated immediately.</p>
            <p>Once activated, you can start watching right away.</p>
            <p><strong>€30 with code SAVE15</strong></p>
            `,
            "Activate now"
          )
        },
        {
          subject: "Still available for €30",
          html: buildEmail(
            "Still available for €30",
            "Your current advantage is still active.",
            `
            <p>Hello,</p>
            <p>SUPA is still available for <strong>€30</strong>.</p>
            <p>You already tested it. Now it only takes activation.</p>
            `,
            "Activate now"
          )
        },
        {
          subject: "Do not miss the next events",
          html: buildEmail(
            "Do not miss the next events",
            "Matches, movies and more are waiting.",
            `
            <p>Hello,</p>
            <p>Every week brings new content:</p>
            <ul>
              <li>👉 Matches</li>
              <li>👉 Movies</li>
              <li>👉 Series</li>
            </ul>
            <p><strong>€30 instead of €45 with SAVE15</strong></p>
            `,
            "Activate now"
          )
        },
        {
          subject: "Final reminder",
          html: buildEmail(
            "Final reminder",
            "Conditions may change after this.",
            `
            <p>Hello,</p>
            <p>This is a final reminder about your SUPA access.</p>
            <p>You already tested the platform. Everything is ready.</p>
            <p><strong>€30 instead of €45 with SAVE15</strong></p>
            `,
            "Activate now"
          )
        }
      ]
    }
  };

  const list = templates[language]?.[type];
  if (!list) {
    return {
      subject: `SUPA automation - ${language} - ${type}`,
      html: buildEmail("SUPA", "SUPA", `<p>No template found.</p>`)
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
