# Privacy review notes (pre-release)

Checklist to re-verify before RuStore publication after AppMetrica / РСЯ are connected.

## Must update

- [ ] Replace Phase 0 draft wording in `docs/privacy.html` with final legal text
- [ ] Add support contact once support email is confirmed
- [ ] Document exact analytics events and whether they include medicine names (prefer not)
- [ ] Document ad SDK data practices and link partner policies
- [ ] Confirm age rating / sensitive category disclosures for RuStore
- [ ] Confirm whether ATT / advertising ID disclosures are required for the chosen SDKs
- [ ] Ensure no production API keys are hardcoded in the repository
- [ ] Ensure `.env` / keystore / signing materials are gitignored and not uploaded

## Product policy reminders

- Ads: one unobtrusive banner on suitable main screens
- No interstitial right after launch
- No interstitial during intake confirmation
- Offline core features must keep working if ads/analytics fail

## Do not claim until true

- Cloud sync
- Account registration
- Transmission of medicine lists to our servers
- Medical advice / diagnosis capabilities
