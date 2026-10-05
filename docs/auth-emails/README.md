# Connexion LeBonTaf : e-mails depuis lebontaf.com

Une seule fois, dans cet ordre.

## 1. Resend : le domaine
1. resend.com > Domains > Add Domain > `lebontaf.com` (région Europe).
2. Ajouter chez le registrar les enregistrements DNS donnés (SPF, DKIM, MX d'envoi). Option conseillée : un enregistrement DMARC `v=DMARC1; p=none; rua=mailto:contact@lebontaf.com`.
3. Attendre « Verified ».
4. API Keys > Create API Key (permission « Sending access », domaine lebontaf.com). Copier la clé (`re_...`).

## 2. Supabase : SMTP personnalisé
Dashboard > Authentication > Emails > SMTP Settings > Enable custom SMTP :

| Champ | Valeur |
|---|---|
| Sender email | `no-reply@lebontaf.com` |
| Sender name | `LeBonTaf` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | la clé `re_...` |

Puis Authentication > Rate Limits : « Rate limit for sending emails » à 100 par heure au moins (30 par défaut avec SMTP perso).

## 3. Supabase : modèles d'e-mail
Authentication > Emails > Templates. Coller le contenu de chaque fichier de ce dossier :
`confirm-signup.html` (Confirm sign up), `magic-link.html` (Magic Link), `reset-password.html` (Reset Password). Les liens pointent vers `/auth/confirm` avec `token_hash`, ce qui marche même si l'e-mail est ouvert sur un autre appareil.

## 4. Supabase : protection des mots de passe
Authentication > Sign In / Providers > Email :
- Confirm email : **activé**
- Minimum password length : **8**
- Password requirements : lettres minuscules, majuscules et chiffres
- **Prevent use of leaked passwords : activé** (HaveIBeenPwned ; plan Pro de Supabase)

Authentication > URL Configuration : Site URL = l'adresse de production, et dans Redirect URLs : `https://<ton-domaine>/auth/confirm` et `https://<ton-domaine>/auth/callback`.

## 5. Google
Authentication > Sign In / Providers > Google : Client ID et Secret du projet Google Cloud. `NEXT_PUBLIC_GOOGLE_SIGNIN=1` est déjà dans Vercel.
