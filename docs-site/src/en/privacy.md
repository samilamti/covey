---
title: Privacy & GDPR
pageId: privacy
order: 3
layout: layouts/page.njk
description: How Covey protects your privacy and complies with the GDPR.
---

## Our privacy policy

Covey is built with privacy as a foundational principle. We collect as little data as possible and delete it as soon as it is no longer needed.

## Data minimisation

### National Identity Number (NIN)

Your national identity number is used solely to verify your identity through BankID. It is **never stored in plain text** -- only as a cryptographic hash (SHA-256). This means that not even we can read your identity number from the database.

### Location data

Location data is only shared during an active session and only with the person you are coordinating with. All location data is **automatically deleted** from the database when the session ends, via a database trigger.

In open requests, your position is rounded to approximately 111-metre precision. Your destination is never shown to others until someone has accepted your request.

### Pseudonymous display names

Your BankID name is not shown to other users. Instead, you choose your own display name. The BankID verification remains in the background for accountability.

## Your rights under the GDPR

### Right to data portability (Article 20)

You can export all your data via **Profile -> Export data**. The export includes:
- Your profile
- Your assistance requests
- Session messages
- Ratings and reviews
- Push subscriptions

### Right to erasure (Article 17)

You can delete your account via **Profile -> Delete account**. The process:

1. The account is marked as deleted (soft delete).
2. A 30-day cooling-off period gives you the opportunity to change your mind.
3. After 30 days, all data is permanently removed by an automatic background process.

## Security model

| Threat | Countermeasure |
|--------|----------------|
| Identifying real names | Pseudonymous display names |
| Cross-referencing users | Profiles only show display name and verification status |
| Accepting requests to approach targets | Verification trails link BankID-verified identities to every session |

### Technical safeguards

- **Encryption in transit** -- All traffic goes through HTTPS (TLS) with automatically renewed certificates.
- **Hashed identity numbers** -- SHA-256, never in plain text.
- **Ephemeral location data** -- Automatically deleted when the session ends.
- **Rounded coordinates** -- Approximately 111 m precision in open listings.
- **Hidden destinations** -- Never shown in open requests.
- **Rate limiting** -- Protects against API abuse.

## No tracking, no advertising

Covey uses no tracking cookies, no third-party analytics and no advertising. We never sell data. The service is free to use, and the revenue model will never be built on your information.

## Contact

If you have questions about our data processing, contact us at [github.com/samilamti/covey](https://github.com/samilamti/covey).
