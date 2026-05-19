- Do not treat X account linking as removed just because X auth login was
  removed. Builder Hub still supports linking an existing profile to X via
  the dedicated `X_LINK_ID` / `X_LINK_SECRET` OAuth credentials.
- Social fields owned by account-link routes should not be saved through the
  generic profile update payload; profile UI should display linked handles
  and route users through the link/disconnect endpoints.
