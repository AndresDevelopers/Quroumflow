# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# Architecture
- Enforce multi-tenancy data isolation by barrio + organización: every user belongs to a barrio and organización, and all queries/filters must scope data to the user's barrio + organización combination so users only see their own ward's data within their own organization. Confidence: 0.75
- For external API authentication, use Firebase Auth ID tokens (verifyIdToken) to dynamically resolve barrioOrg from c_users — do not use a static EXTERNAL_BARRIO_ORG env variable. The external web app authenticates as a registered user, and the user's barrio + organización in c_users determines what data is returned. Confidence: 0.75

