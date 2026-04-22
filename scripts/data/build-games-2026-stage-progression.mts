export type BuildGamesStageSeedRow = {
  bucket: string;
  projectId: string;
  projectName: string;
  memberConfirmation: string;
  stage: 1 | 2 | 3 | 4;
  stageClassification:
    | 'stage_1_applied'
    | 'stage_2_only'
    | 'stage_3_only'
    | 'stage_4_finalist';
};

// Bucket -> (stage, classification) lookup. The bucket column on each row
// drives the mapping, so adding a new bucket is a one-line change here.
const BUCKET_TO_STAGE: Record<
  string,
  { stage: 1 | 2 | 3 | 4; classification: BuildGamesStageSeedRow['stageClassification'] }
> = {
  'Stage 1': { stage: 1, classification: 'stage_1_applied' },
  'Stage 2': { stage: 2, classification: 'stage_2_only' },
  'Stage 3': { stage: 3, classification: 'stage_3_only' },
  'Stage 4': { stage: 4, classification: 'stage_4_finalist' },
};

const RAW_BUILD_GAMES_2026_STAGE_ROWS = String.raw`
Stage 4	5cd3c05b-9ff9-4a6d-bc48-8c20fdea93b0	Tenor Protocol	Selected as finalist
Stage 4	924f14e6-e208-48db-b5ac-6e7a37cdeb18	Ammo Markets	Selected as finalist
Stage 4	4cfbdbd3-4ef9-4dfb-ad14-ed22f6103268	Katchi	Selected as finalist
Stage 4	d4721880-29d6-440d-aa68-2db5152872f0	Abitus	Selected as finalist
Stage 4	d8c6e7ae-c688-42e8-9f69-4acdedbf394e	Dhahaby	Selected as finalist
Stage 4	edce2986-8758-442d-917e-00e4f1eb6492	Poll It	Selected as finalist
Stage 4	fa670214-81bf-4eef-ad9b-cc984d73cf6d	WeBlock	Selected as finalist
Stage 4	57b8cafb-2e7f-4272-83f3-05ef761e91d8	Avantage	Selected as finalist
Stage 4	f74eb671-8241-4ab1-88d6-7e4165f51e8f	AMP Avalanche Matchmaking Protocol	Selected as finalist
Stage 4	de2cb83a-8ca4-4f83-8266-2373ea5fea6c	The Grotto L1	Selected as finalist
Stage 4	2d76cf52-2311-4a40-a916-b9d7d0c88ecd	PAYPS: From Web2 to Web3	Selected as finalist
Stage 4	03f9bf07-f6bb-4dd5-9f0d-aba7b0f0dfd9	Meridian	Selected as finalist
Stage 4	18ac267e-44a3-453d-ba8b-7dc92f5265aa	We Keep Winning	Selected as finalist
Stage 4	7e43bfec-c7f4-4eda-b7c3-6278926281f8	Your Grails	Selected as finalist
Stage 4	51c4ffe8-81be-49ab-9820-4b879c82604e	Senku	Selected as finalist
Stage 4	e7fda485-2729-49eb-bb3a-da93c2c3746f	PartyHat	Selected as finalist
Stage 4	2b754151-0969-429f-97de-8642a2f8fdb6	FanCrypto	Selected as finalist
Stage 4	ebc06634-36e5-4997-94e4-c9648736c626	Forg3t Protocol	Selected as finalist
Stage 4	38860010-b46a-40e7-a0b2-63b9fdb57d9a	SOVA	Selected as finalist
Stage 4	746b1cb1-f477-436b-affb-6368d37112e0	Predict by Kokomo Games	Selected as finalist
Stage 4	c8ea9cdc-3f61-4942-9aa1-c35283691cbb	Peridot	Selected as finalist
Stage 4	09c59782-d3c8-47d7-85d5-a25cfb73997a	alma	Selected as finalist
Stage 4	a4455640-cc1b-4eef-ae12-149751fb818f	Knovel Protocol	Selected as finalist
Stage 3	83edaac7-655f-409c-a961-eb5867aa7e9c	Gladius	Made final event list
Stage 3	98b5a16f-f43f-4a5e-9391-a5884817f422	Lil Burn	Made final event list
Stage 3	aadfaec0-d608-4b8d-912d-3eda4a50b775	SliqPay Africa	Made final event list
Stage 3	70d9f612-b12e-41b2-a975-110d60b1cc04	Wolfi Rumble	Made final event list
Stage 3	eb786a44-3f59-4dc2-81ec-023e151a24fc	AvaPay	Made final event list
Stage 3	ae864b9f-7727-40c7-ac2c-0c9899394f9e	OmeSwap	Made final event list
Stage 3	7e976679-6033-422d-a10e-2d34ea0a4387	Falaj	Made final event list
Stage 3	ede27121-8475-42c3-8995-b00ee1af8cc6	Loopia	Made final event list
Stage 3	daca4fa7-a44b-4741-97c5-8a1fc259da39	Autonomous Treasury Guardian	Made final event list
Stage 3	3e7c7f7a-e622-4b20-aa5a-10ea2684dba1	QuantumsFate	Made final event list
Stage 3	60147f38-6e29-4d0f-94a3-4556db7f0fb8	Tippikl	Made final event list
Stage 3	105d46a8-a25f-40dc-8ee6-77deb52f8f47	Shroud Network	Made final event list
Stage 3	6c8a0a9e-057b-43bf-8333-b3bf105658f1	8004Agent.Network	Made final event list
Stage 3	f9913179-1682-4ce5-b6e3-830be576066e	OneClick Wallet	Made final event list
Stage 3	7b4327bd-f9d7-428b-9ec6-44d273020faa	Vietnamese Fine Art Copyright Protection Ecosystem	Made final event list
Stage 3	6f726ee5-5a9f-43b1-b4c1-f0d27319aebf	Trexx	Made final event list
Stage 3	a0de9c81-72f1-44e3-9dd9-c37212e0f0a0	Warriors_AI-Rena	Made final event list
Stage 3	b98bde5a-d4be-436d-917d-67136cd3051d	BitStat	Made final event list
Stage 3	2ca3ee33-13b5-4cb4-9ea6-83a7d60bcc9f	Eavesdrop	Made final event list
Stage 3	bd4bfe31-92fd-4f21-ab46-a512b42b9303	Basis Network	Made final event list
Stage 3	e81656fc-4b93-4468-ad81-d262c6b9f81f	Gam3 Colony	Made final event list
Stage 3	412cb893-f67e-4cd2-86b5-4103affd178f	Skullzee (by MadSkullz)	Made final event list
Stage 3	6eb473bd-d512-44ec-9536-fc8640d27adc	Icicle Markets	Made final event list
Stage 3	2daa62f2-562c-4153-82b6-dc3ac26cfc25	AVAX Bingo	Made final event list
Stage 3	7f43e437-a6bc-4b8d-907d-056cbd7986e0	Lorescore	Made final event list
Stage 3	9c2bcf59-19d4-4952-b1fd-9efa2c256c6f	GUNZscope	Made final event list
Stage 3	c93ebe04-ab4e-45d9-bea8-1a54de3e4e59	ARI	Made final event list
Stage 3	401532f3-c508-462f-8528-29ba0cc49cbd	guudscore	Made final event list
Stage 3	3c8d1f7b-1e52-4b08-a5e1-ff289f4a136a	Capy Sword	Made final event list
Stage 3	9d4123b0-75f2-47ab-ad45-b37c119289f8	Facinet	Made final event list
Stage 3	c599cd94-bc57-4636-9f08-78b905ce4077	My Nochillio	Made final event list
Stage 3	3f897730-51e1-4a31-8a95-7dd87bb436b4	ProTennis.fun	Made final event list
Stage 3	1f9b8104-e525-4b49-ad03-a34cabeb2c55	Mimix	Made final event list
Stage 3	a823f09e-b642-4c2f-b102-e0d53004989a	Renew.sh	Made final event list
Stage 3	0a099493-c51a-4195-a736-1208431fbcdb	Conquest	Made final event list
Stage 3	2df0559e-c405-432f-a546-2d1d9d6436c6	AgentProof	Made final event list
Stage 3	50599767-19c5-406c-a4a7-30375945edf6	AuraReserve	Made final event list
Stage 3	500b0382-b9c7-4e32-8ee0-76e3c66768bf	RapiLoans	Made final event list
Stage 3	0073995d-f3c8-47be-9197-38f251e385c1	Collider V2	Made final event list
Stage 3	2f814596-67c7-46c4-b3a4-871019df6b3d	CARE Quest	Made final event list
Stage 3	9039c4d0-9330-4b2e-ae7b-2e89e72e6233	CAUSAL	Made final event list
Stage 3	68c23f96-7700-4647-b83e-c2802147453e	FiatRails Settlement	Made final event list
Stage 3	db19b98c-e5f6-47cb-a984-dfa1e2820d47	A2: The Saga of Alaz & Ayaz - A Tactical Duel of Fire & Ice	Made final event list
Stage 3	760a4768-0e2f-4f3a-96fb-5619b55faf88	Tallyview	Made final event list
Stage 3	8b076878-2552-4a10-b449-4e6797632892	Avanomad	Made final event list
Stage 3	28b8a901-b8a0-4599-bd7a-03e996fb5d17	Alpha Street	Made final event list
Stage 3	82dd801e-ba9b-4c09-bafa-19e4db1bb79f	Avalanche Blockchain based Secure Voting System	Made final event list
Stage 3	7b7721ba-935b-4388-b02e-de3b156fca40	BUFI	Made final event list
Stage 3	45825555-52f4-4d39-adda-28053adff3eb	Prize Bots Online	Made final event list
Stage 3	d6e0e194-3cab-4b48-a4f2-7e3934d89e62	Noah	Made final event list
Stage 3	7ec33d03-3178-47fc-be77-6f9da35c7603	MeltFi	Made final event list
Stage 3	0c867d08-ee0a-4648-b909-479652faf0e0	Mosaic	Made final event list
Stage 3	4aa8b19a-43e6-45ee-ba27-57f25cb40373	ZeroX Protocol	Made final event list
Stage 3	9c3f557b-aacd-4dc4-802a-fb7901054b8a	Atala Finance	Made final event list
Stage 3	bd0a52bd-0728-40d0-bd89-66bd60c449a1	Dreams	Made final event list
Stage 3	67aefdd6-331f-4444-bce7-0e2c96fc74a7	Polar	Made final event list
Stage 3	11d7e1f2-f8ea-47d6-9f26-f1ec8b209615	COLOSSEUM	Made final event list
Stage 3	2b7388da-4df6-4532-8082-4b66cb5a3d08	aiSports - Crypto Daily Fantasy Sports	Made final event list
Stage 3	2757965e-292b-4a89-82a1-6779dfc1beb9	Moltfluence	Made final event list
Stage 3	c0c8029b-4931-45bd-add8-165714fea218	XMind Capital	Made final event list
Stage 3	83466d06-cee2-4671-bf4d-c471b71673c0	LUTA: Luminoria Tactics	Made final event list
Stage 3	e941a4ac-b5be-4c91-8c09-fe20ee7e6ea7	CropPerps	Made final event list
Stage 3	89243de7-3381-4c7a-82af-4d3ece9f2d41	Avadix	Made final event list
Stage 3	c013e25b-ce0c-4518-bd53-83641cd31c73	SigmaV	Made final event list
Stage 3	a0e3b589-5f50-4b62-8b0d-4eff0e2bb8d3	Flare	Made final event list
Stage 3	40993b21-0fe8-49e4-b418-cc8870e9335d	polydraft	Made final event list
Stage 3	a708930f-4f63-4c32-8602-a454ff209d21	Salient Yachts	Made final event list
Stage 3	92aaa834-59a6-40e6-9ef0-ee3d2fa93b0d	AION YIELD	Made final event list
Stage 3	b3379874-2295-4699-8225-18e38c5aeea1	Composed Protocol	Made final event list
Stage 3	8d317210-9e5a-4196-b46c-8ea5281a9c14	PermaDEX	Made final event list
Stage 3	ddee0fd4-9a5b-46c6-aa32-255a04a1563b	PULSAR	Made final event list
Stage 3	4d64e67b-b194-408b-a685-c5b2b560ca6d	MNWalk	Made final event list
Stage 3	1ee0fe49-2a87-4b50-86b5-5d69cdf5fb16	MI;Re (My Implant Record)	Made final event list
Stage 3	b465c36a-e162-4beb-bbaa-cc185adbb9dd	MuriData	Made final event list
Stage 3	0a75d6cd-c36d-4b9f-8a7a-0a65eb44feac	Wasiai	Made final event list
Stage 3	4fca641a-79b3-480f-9d27-0e8b577dee31	Red Pepe Arcade	Made final event list
Stage 3	e8f69381-4405-48d6-ba55-c37b1d21fa5f	SOCI4L	Made final event list
Stage 3	4e5cdd9b-0c1d-474e-9e34-e89651b26f0d	Kura	Made final event list
Stage 3	d055e3db-c4eb-479d-bab8-5989db25308a	ProofMark	Made final event list
Stage 3	f0ed3048-889f-4561-812e-9b38b41d6e31	StrataDeed	Made final event list
Stage 3	6f77d514-cf85-48b6-9a63-c2ae933f0624	ChainBois	Made final event list
Stage 3	11c594d6-0bec-4bca-8c00-c7ae2832dec4	AVAJAZAMITI	Made final event list
Stage 3	40594c70-5ae3-4380-b69d-d4f1b35ae4e2	Starlight Armada	Made final event list
Stage 3	be33f0a4-5b0e-40ff-be87-c01630e83e91	Nomos Protocol	Made final event list
Stage 3	81f844ff-f5f0-49df-a649-3f823dcb8562	DexPal	Made final event list
Stage 3	b6fbee5f-64f9-47cc-bb46-e05bfc3c5e69	ExNihilo	Made final event list
Stage 3	8d5b51e8-99d9-4a4c-b3a2-d8c6027faa26	PeakBalance	Made final event list
Stage 3	279daf1d-03b9-48f5-98d0-d5167d9b2ce8	Sentinel Protocol	Made final event list
Stage 3	27adaf88-4096-4f25-a092-b815529ccd1b	TrendZap	Made final event list
Stage 3	cd9870ef-5ce8-45c8-92fb-9f9f7513eb7e	Ur Finance	Made final event list
Stage 3	74b91a33-7c65-47b0-a32d-466a678a1b26	Local Universe	Made final event list
Stage 3	1eebab23-f1c0-4c45-a043-ee32af0ed226	AvaForensics	Made final event list
Stage 3	33bb53df-9fc5-4499-b903-959c154c54ec	GRAFT Ecosystem	Made final event list
Stage 3	a661ef0b-a5e0-45cf-890b-ab960190dc97	Drift Hub	Made final event list
Stage 3	fc8229c6-945b-4070-b212-0757c95959fb	SportChain	Made final event list
Stage 3	d62bfe67-33bd-4864-8ca5-a901a546ffce	WavCash	Made final event list
Stage 3	9d8c3afd-7063-4ca8-9e20-c7a2aa2444f6	Sparkclub.xyz	Made final event list
Stage 3	73f4561e-4c97-4998-9086-fad9a76145c8	Mad Apes	Made final event list
Stage 3	84cac00d-1322-4622-b409-9e0e71dc951b	XRamp	Made final event list
Stage 3	e35fe9a4-a8d5-4cfa-878d-077717f2b396	kardpay	Made final event list
Stage 3	694fa9ca-1ddd-4042-a621-cc13e40f7e52	ChaiTrade	Made final event list
Stage 3	ae53f430-8c68-4078-8633-450864587c13	LayerCover	Made final event list
Stage 3	71847f63-9922-486c-929a-a9b98689f44b	Folks Mobile	Made final event list
Stage 3	072ca83b-3e5c-442f-ba5b-50abaa312e05	Gem Mint Strategy	Made final event list
Stage 3	e7d339b0-6d7b-4b87-8a58-2fa4efff79b6	PyVax	Made final event list
Stage 2	c9329f64-f3da-4b2e-8163-96f5e0827d34	0rca	S1 accepted
Stage 2	baa3b8b9-7902-43a9-a302-4334c1c5a222	A-pex or Apex	S1 accepted
Stage 2	321504bd-e380-468e-b4c5-234c25f05d3d	AVAXVERSE	S1 accepted
Stage 2	500b016b-eb4b-42fe-bf75-8e1bd931c2aa	Colmena	S1 accepted
Stage 2	4a2dffd2-658c-4364-a46f-341cd8dafa54	Devote	S1 accepted
Stage 2	0f86fb65-6e29-4c48-a2bb-379ad243b079	Isbjorn	S1 accepted
Stage 2	65427244-90cb-417e-9ed8-33a2e816069d	LocalDao	S1 accepted
Stage 2	bcad110f-f60c-47b6-833e-7c3df9d32be6	RedKey DAO	S1 accepted
Stage 2	03f08301-15c1-49ad-aeba-5aefecd85f39	SnowForge	S1 accepted
Stage 2	392421ad-eaa9-4a73-b964-a11bebe362ff	AcadChain	S1 accepted
Stage 2	1863577b-d812-49c2-ab18-5759e93b45f8	AD GAS	S1 accepted
Stage 2	ee51f299-0d45-404f-9baa-b471d4eb97ab	Art Guard	S1 accepted
Stage 2	12835e79-6f93-47fe-be1f-20aa013be44b	Avaira	S1 accepted
Stage 2	db82da1c-9e93-45af-8062-bb1352fe8ba5	AvaxLens	S1 accepted
Stage 2	8bf9105f-fe60-48b1-913c-1d108c6a182b	Arcadefi	S1 accepted
Stage 2	68054dc9-d7bf-456e-96e2-c44bdd63dbb4	Ayni	S1 accepted
Stage 2	397466d1-ba67-4bf4-8a17-d51262175252	Baseroot V2	S1 accepted
Stage 2	08a9a9c1-a7f3-4d18-aff5-8a71b4c9d427	BetBit Sports	S1 accepted
Stage 2	bdcb9fd5-a447-4e9a-89be-e30fdaf099b6	Ascend	S1 accepted
Stage 2	ec924d5f-9525-44d8-9e08-da917decfc75	BitVoy	S1 accepted
Stage 2	d9c25fd1-cdcb-4a21-b86e-5b396bc882b8	AstroFinance	S1 accepted
Stage 2	d86fcd59-65e7-472f-b504-2377a586fe63	ChainSentry AI	S1 accepted
Stage 2	59666fec-5bb4-45b0-8aca-c9c19bf50f80	Chapter IP	S1 accepted
Stage 2	cfda749d-c01e-4fe1-8ddd-9bef9ae21e42	Aurayale web3 TCG	S1 accepted
Stage 2	083cf0e6-d6a2-4d07-a73b-fc1a82e0c868	Conviction Clash	S1 accepted
Stage 2	12037c4f-0524-4c33-b797-979805817a32	Cre8	S1 accepted
Stage 2	3be9beed-1f35-4705-8e95-262d381c13e1	DR Agent	S1 accepted
Stage 2	0da091c7-d191-4a6a-9193-565f7481f9b8	FFUNDER.io	S1 accepted
Stage 2	073227a1-10d4-4c4b-bb5b-76ae7c798ff6	HealthProof	S1 accepted
Stage 2	ee0b105b-b69a-473c-a83a-d8b169703701	Hodleague	S1 accepted
Stage 2	06989fe8-b6cd-407c-a21a-ac1df539af48	JetFlow	S1 accepted
Stage 2	39009dfd-1a21-40d0-b9d6-f10e66a2222d	KAIKAN	S1 accepted
Stage 2	e1d3b309-5d1f-419b-9ba0-74d3c8565e96	Kosyn AI	S1 accepted
Stage 2	172fb7d7-ba9a-4d44-bf0c-4263af0ae1f2	lpscanner.xyz	S1 accepted
Stage 2	2588b10f-b697-4eb8-9237-c56d859a49d9	MoneyKicks	S1 accepted
Stage 2	3c257baa-b4d8-4225-a99a-aaf94539ac54	Oria	S1 accepted
Stage 2	787daca4-e1a6-4c8d-8790-712dd8e05c7d	PayEase	S1 accepted
Stage 2	9d8f2a08-2ea0-4fd5-ae2b-73ea8ffe9fdd	Awra	S1 accepted
Stage 2	1ba0f57a-e137-4d62-9446-387bc7d97260	SecureClaw	S1 accepted
Stage 2	3f6aadc9-65d7-4155-8428-6997234b4a4e	Splitly - The Payments Splitter Factory	S1 accepted
Stage 2	d891b5c6-a54f-4bc1-9fce-173f67e87eb6	Todin	S1 accepted
Stage 2	659fffe5-c130-4b40-bb1d-7ac177490c36	AvaPay	S1 accepted
Stage 2	0c602478-eb1b-4b1d-88cc-1be09a108b70	zene	S1 accepted
Stage 2	89820022-0242-48c1-9985-32926bfb2506	DARC - Decentralyzed Agent Registry Chain	S1 accepted
Stage 2	f7f6b123-73cc-4c9f-b3f3-e6a0e02f68be	Hyperscape	S1 accepted
Stage 2	d81f2ba7-d5d1-4702-977c-1d9645b5dc7d	Menra AI	S1 accepted
Stage 2	46dfbb71-a0fb-469c-87e0-454a7552f3a6	Popular Mandate: 2019	S1 accepted
Stage 2	1591f594-fa87-41bd-948f-f40af9e5c3d6	SKYDN	S1 accepted
Stage 2	a72b6261-8746-4e8b-8703-f9deab1888df	Sportwarren	S1 accepted
Stage 2	3ee1f9e6-a49a-486d-af99-bf8b770dc9cd	Akasthara	S1 accepted
Stage 2	79bc5a39-5c0a-441b-8abb-47419e514331	Avacado	S1 accepted
Stage 2	a39e5130-ffd2-4fa4-8f29-c835d4cd6df2	Avaxopoly	S1 accepted
Stage 2	cd20910c-4e40-4bf0-909b-c9ee00d00460	AvaxTap	S1 accepted
Stage 2	3192ee5f-83ed-4fdc-a0c5-8b3c2b9d1b4f	Bearly Awesome	S1 accepted
Stage 2	74baf644-19cc-4906-b0a6-3783ef469e59	Black Cat	S1 accepted
Stage 2	4fd1c92b-74d1-43b5-965c-5e67fbcd83c9	Blobox	S1 accepted
Stage 2	cd74dbac-767d-42f2-9d87-b89b371bd2db	BlockBot	S1 accepted
Stage 2	08734d07-b831-4a87-86c8-b9c344a7796a	COA Kit - Coin Operated Agents	S1 accepted
Stage 2	7d161f5f-b0fc-48e1-a9bf-8a801ea3fd01	BlockControl	S1 accepted
Stage 2	221990c7-afe0-4c40-8199-61ad3dd2e2e4	Buns.fun	S1 accepted
Stage 2	90f027b3-07a4-4726-be65-7b9e97b060d9	Chainrades	S1 accepted
Stage 2	8434570b-fb1f-4fba-ad15-e71cb2786f53	Crowback	S1 accepted
Stage 2	86043537-28fd-47ac-8df3-f5108c7f0bb7	CZA: Cowboys, Zombies and Aliens	S1 accepted
Stage 2	f3da9610-831f-45fa-9e09-5b1b92a5236e	Dark prep	S1 accepted
Stage 2	9a838b64-8cb6-45e9-aa23-b95e0e5a7c39	EscapeHub	S1 accepted
Stage 2	56fe53cc-55a3-42af-9894-30752bd25796	Eventify	S1 accepted
Stage 2	74fb195e-db58-41cd-aa32-087b6b4eedaf	DARC - Decentralyzed Agent Registry Chain	S1 accepted
Stage 2	70828c1f-bf7d-431f-bf05-81a731bf63fe	DARC - Decentralyzed Agent Registry Chain	S1 accepted
Stage 2	0dd1bf72-5946-4520-bfdb-6f5c6c227638	DARC - Decentralyzed Agent Registry Chain	S1 accepted
Stage 2	d49f85c1-01d4-485a-95df-a6d75c58deec	DARC - Decentralyzed Agent Registry Chain	S1 accepted
Stage 2	878aed59-73da-4910-9870-3f08a6cf8dfe	Execution Market	S1 accepted
Stage 2	f77c540a-279d-41fd-b0fc-60112c5eceec	Festify	S1 accepted
Stage 2	d75c9d1b-3c10-4861-8fe0-65681a66931a	Fiducia AI	S1 accepted
Stage 2	9e886159-4c27-418b-bb84-58511a0a084a	FISHER: Guardians of the Blue Tank	S1 accepted
Stage 2	4ba02e80-25a3-4e8a-813a-eddfe13592c1	Geode	S1 accepted
Stage 2	632769ea-ce96-4861-bb38-12b753479402	Glade (GameFi/RWA)	S1 accepted
Stage 2	d3d9cb54-ff82-47cb-b771-ec7edcf0c72e	Growi	S1 accepted
Stage 2	413601bc-bc6e-4fff-b196-3e5a11e39679	Dreams	S1 accepted
Stage 2	558567c2-49da-46e0-a6dc-a09d5f7ea22a	HealthVault	S1 accepted
Stage 2	2a8d9945-83a9-4a59-a068-25b0b7b1583f	JAW	S1 accepted
Stage 2	a7882ab5-43e2-4d55-8cb8-be603a3944e8	Escalate	S1 accepted
Stage 2	eaf32e84-8818-4d7c-bbc9-71a3955a5997	Knotic	S1 accepted
Stage 2	ef4763f5-4608-4b70-bb01-0881e3d2705b	Kraven	S1 accepted
Stage 2	c3f8da0c-0e88-4a37-9091-d99ad50cbfae	Lanista	S1 accepted
Stage 2	ac5a8378-22b0-4a63-9ae2-046a93d89539	Fame Farm	S1 accepted
Stage 2	377ab0f3-07fd-46cf-a613-b36d458ea8d2	LootDrop	S1 accepted
Stage 2	24630f53-6853-447a-8d50-b5d56c8f151e	Lucid RED	S1 accepted
Stage 2	957302ce-ba34-444e-b067-b8e8bd90d226	Matterhorn	S1 accepted
Stage 2	7f7db811-f64b-4ad9-b8a0-cb92e3492b31	Mibboverse	S1 accepted
Stage 2	7b48126e-38dc-41c6-b498-45398777850f	Finding Nakamoto	S1 accepted
Stage 2	9de02f5e-7988-487f-bc06-80424e7f0816	MoonTic	S1 accepted
Stage 2	bc730a6c-9f09-4935-8398-161992657d5e	Flare	S1 accepted
Stage 2	2618ef9d-71fb-4d37-ab97-d5eefb61c9f7	MyBarter	S1 accepted
Stage 2	d52f4533-6500-48a0-bfac-e57291998bf3	FLY on Avalanche	S1 accepted
Stage 2	1bced90c-fa6a-4de8-9577-f678277b9144	MyLegacy by Etherland	S1 accepted
Stage 2	be7b2853-21b5-4395-a10e-0dc1c7fab0ab	NeonLaunch	S1 accepted
Stage 2	c868ad95-b3d9-457d-8888-832d2e961c50	OGbank	S1 accepted
Stage 2	e5cc8514-c6c0-47d3-91c8-3a72c559da28	Game Haus	S1 accepted
Stage 2	d2bee114-395a-48e7-9c48-64c876fbd570	REBOND	S1 accepted
Stage 2	c545fb44-b0af-4f8e-be3e-7b1134b6dd5f	Road Raiders	S1 accepted
Stage 2	6044baae-d1d5-437b-a675-e44150f1fa0c	Robotania	S1 accepted
Stage 2	aef58f4f-a497-4874-aa00-d7c301e3c6a0	GRAFT Ecosystem	S1 accepted
Stage 2	a4fe6d35-667a-41ea-b35b-9d2c55afe535	Sabaki	S1 accepted
Stage 2	5cd47818-b068-4fb1-9095-27ce0748a70c	Safe Sphere : A VR Based Training Platform for Women	S1 accepted
Stage 2	8e35c43c-9a42-4fc3-a4d8-c2cf55e9a04c	Sha(vax)re	S1 accepted
Stage 2	9590996e-a86e-4335-9974-7361cfde1d93	SHARd	S1 accepted
Stage 2	af8a0ea3-bbd1-4720-820a-8385b3abd0ff	SnowMerge	S1 accepted
Stage 2	a5022f1b-7fcc-47b1-aa5c-f9ca9631aef4	Sonic Kulture	S1 accepted
Stage 2	f5d468e4-ec9a-4cf9-b777-c16d2da3be5d	SpermDOTFun	S1 accepted
Stage 2	eeb70245-1abc-49ba-8b77-1a9a08fdff5c	Stabletown's CityChain Kit	S1 accepted
Stage 2	0e05e166-46ae-4be5-9fe5-1cd361964d45	Hyperscape	S1 accepted
Stage 2	e932e8ac-29e7-45a8-ab6b-75dde27e781a	Subnet Gas Station	S1 accepted
Stage 2	a828c6db-f02f-4c3d-abde-0f31651c3a16	Summer Dash	S1 accepted
Stage 2	5cb9af85-ef73-4142-a537-132a0e88f20c	TAKEOVER	S1 accepted
Stage 2	d1bfb293-b6ff-4501-9a2c-5a0f93f3f1f4	TechIP	S1 accepted
Stage 2	673b5f2f-3887-4c65-a32d-1b9569ef693a	Kaiju Composer Battles: MATRYOSHKA DOLL LIBRETTO SYSTEM	S1 accepted
Stage 2	b01fe3ec-b1ac-4b37-b63c-6aadb32e3fc5	TGR - Temporary Game Rollups	S1 accepted
Stage 2	ee838c70-cc3c-497d-8b53-46ff1f1610b0	The Haus	S1 accepted
Stage 2	22933c36-5fbe-41b0-851c-650f2d3c10d2	Thikra	S1 accepted
Stage 2	af49fb09-402e-40cc-a2ec-6037e8dce1b5	Trivvo	S1 accepted
Stage 2	6dfcd04f-8730-4a00-a768-85e84841e8ea	TrustChain (Powered by ZERO)	S1 accepted
Stage 2	ef69317f-a334-409e-b7bc-c99ae51ec887	UGC (this is a placeholder)	S1 accepted
Stage 2	2dbaaa1c-e597-4edc-9da4-c6eb1b5e9cf0	Unseen Pulse	S1 accepted
Stage 2	6d2df939-169d-4fc2-a70f-f32486a527ce	Varity	S1 accepted
Stage 2	61a6a801-d915-45cd-8be7-14c609dec3c4	Vaultic Trust	S1 accepted
Stage 2	c407a1bb-2a50-4581-af8e-a4a01f83baea	Veilcraft	S1 accepted
Stage 2	9e297cf8-4a5d-4a4b-9ece-deb668eca8fc	VLOTS	S1 accepted
Stage 2	b3abe780-77d6-447b-a114-4ccfe36768be	Wager Wars	S1 accepted
Stage 2	123b3a86-b7a4-45c3-97ad-3989bb1d9cf4	Zer0th Protocol	S1 accepted
Stage 2	3026c014-246e-4c24-8758-7d9e5ff6c81c	Zero Degree	S1 accepted
Stage 2	475137ff-9610-41b2-bb22-ccb06b31e772	Ajoo Onchain	S1 accepted
Stage 2	9fd254d0-0c37-4584-9960-010c60b11e5e	LootRoyal	S1 accepted
Stage 2	413b44c1-f038-4a67-9a46-8ff730171598	C-Pesa	S1 accepted
Stage 2	56d327f3-3543-44bc-92ce-c83cf95015a2	ChainLancer	S1 accepted
Stage 2	52662277-b013-4f0f-b936-2f02b07af46e	Circlepot	S1 accepted
Stage 2	d41533a8-c9bd-461f-8eb4-284d860c5c0b	CiTy4Change	S1 accepted
Stage 2	b43854f1-f5fb-4221-a983-2d6ebef5d134	Clutch	S1 accepted
Stage 2	5d616d44-8bf2-46f6-a8c4-3dc210fa04d9	Kellon Mobile App	S1 accepted
Stage 2	c819f797-d2a5-430a-bba9-30b4afbbbf62	Mochi Agents	S1 accepted
Stage 2	2bc22924-98a1-46cd-9095-9cbb79757147	Nebula	S1 accepted
Stage 2	cda9cddb-5cb4-4e22-ae82-fef11c62936b	Organic Kingdom	S1 accepted
Stage 2	573a7bce-fe2d-465c-b726-3251c0b0bfd8	Pasha	S1 accepted
Stage 2	67be49ba-fa38-4ac1-8025-98508618326f	Seven Skies	S1 accepted
Stage 2	c83ebde7-f128-4ded-9abf-aeed0d9b9b2e	Snowball SDK	S1 accepted
Stage 2	b13a3413-b032-4aee-8266-43559b4a9e0e	Space Quest	S1 accepted
Stage 2	bd516192-d92b-4f33-a62b-bedd5d2a6765	THE CORE	S1 accepted
Stage 2	017e81e3-fe9b-4959-a2ec-0801ce83a31c	The Heritage Splitter	S1 accepted
Stage 2	5266aad2-b6cc-436f-b307-fefa17e6f3c9	TRESR Game	S1 accepted
Stage 2	c52fa9c9-f714-4454-840f-932af0940d9d	AbstractPay	S1 accepted
Stage 2	b52ca79f-261f-43bf-82e5-fb578a83721a	APIX	S1 accepted
Stage 2	48a371df-543b-436d-ad72-f62f79969877	Authvoid	S1 accepted
Stage 2	46603ed4-2824-44d2-9e0f-25c7a82e35e0	Avalanchai	S1 accepted
Stage 2	9c40a489-6fa8-4437-b933-77505b4da9f9	Avalanche Wars	S1 accepted
Stage 2	44da88fd-a5c0-4909-98c1-24e39bd3472b	Avalore Cards	S1 accepted
Stage 2	bf11e44f-22de-4b6d-a771-cb9970832e13	Olla	S1 accepted
Stage 2	54951211-c846-490b-a30e-f807433fef61	Celeris	S1 accepted
Stage 2	1e9f40bf-dbb0-4dbf-af15-3961973e9c9b	Clawdfeed	S1 accepted
Stage 2	1d0cc746-c9f8-45c6-8af4-9dc084f1bf95	Convey	S1 accepted
Stage 2	c603b301-6c3f-4f3a-a6a3-a5e9689e95c1	FitConnect	S1 accepted
Stage 2	97a068b1-1832-43c5-86b1-aee148406660	XKOVA	S1 accepted
Stage 2	51dbabc5-92ed-4ab3-b1bb-f7dcddb98c28	HIR3	S1 accepted
Stage 2	840d41c9-5fb8-405f-971d-e61d710c97ae	KickoffRivals	S1 accepted
Stage 2	fe6b89a7-b05a-49b8-94af-e03b493de6ec	PartyHat	S1 accepted
Stage 2	8160bce3-1253-4d69-89d6-a2f3d6fba259	Lootopoly	S1 accepted
Stage 2	8f4862a3-c924-4290-9a4d-f9127a071d4f	Lucky Goal	S1 accepted
Stage 2	1f8f5fc7-a427-4ce7-8026-61bf16bea66c	Metarchy	S1 accepted
Stage 2	957610da-9aa9-44e2-95f2-745b0903cb21	Node Defenders	S1 accepted
Stage 2	b49433bf-6a58-4ff3-b763-3f5e24fdb605	PredP.red	S1 accepted
Stage 2	c30f2a2b-13b7-4805-8e9d-425c19d6301d	SPARC-Reactor	S1 accepted
Stage 2	0cc93f99-2a11-4560-926e-887d3b6781b8	Spicy Renegades: Mayhem	S1 accepted
Stage 2	2bf8b03f-1760-478c-ab79-c5ba0fe6d6ce	Surely	S1 accepted
Stage 2	e199d7b8-0f44-4403-bcfc-2266e25d0453	Workmage	S1 accepted
Stage 2	fa5d2bc6-b4ab-4e88-a837-e81071b05f57	Poll It	S1 accepted
Stage 2	27a3fc86-8179-4fb9-a3c1-05b4c6f6c180	XYTHUM	S1 accepted
Stage 2	c356e581-a2ad-427b-ab1b-ae97b119f239	Popular Mandate: 2019	S1 accepted
Stage 2	f467d894-d581-45f3-9e7a-507dfd71abfa	Ancient	S1 accepted
Stage 2	5ad91cd0-1904-4d3f-9b26-592a8e908726	Animazions	S1 accepted
Stage 2	bf50432e-126b-4260-95af-a514f77a5787	chasqui app	S1 accepted
Stage 2	3e56add3-cc71-4307-8add-92ab762d100e	D3fenders	S1 accepted
Stage 2	abeef5ae-d785-44c1-85e7-fee76f1e07c7	DEEPROCK	S1 accepted
Stage 2	f1e0f3c6-1334-441f-8c05-5e08775ff1be	DegenCalls	S1 accepted
Stage 2	ecc41367-76b8-412c-b691-725025612ddc	DigiFight Game	S1 accepted
Stage 2	74393c34-ddfd-4390-a12c-beca3d821dc5	PyVax	S1 accepted
Stage 2	9f57be31-62af-4b03-b647-799d2d16df00	dooova	S1 accepted
Stage 2	cf14fd21-4081-4c73-83f0-17f0942f30e2	Draft Labs - PickSix/Draftables Football League	S1 accepted
Stage 2	257f1080-216a-4a3e-a3fc-5b1fc89a6f7e	QuidditAI	S1 accepted
Stage 2	14de8e83-5368-4387-95f1-4b64c0d968a5	Flesh Nuggets	S1 accepted
Stage 2	863b5c2a-230b-4d8e-8575-efea0b57cbbe	GlitchRuner	S1 accepted
Stage 2	01c9f4e0-ceac-4477-8a03-f3ed92d2e7fa	Guess Who Game	S1 accepted
Stage 2	cce3003e-d8ee-4952-8858-32dcd90e2162	Gundrive	S1 accepted
Stage 2	6521082e-ab3b-47d1-8184-fb0c272a09f7	Gunnies.io	S1 accepted
Stage 2	b7e65993-5a6a-4c1e-835c-10c0621de1b2	Royal 64	S1 accepted
Stage 2	82d3bf4b-1fed-4989-a53c-32ea026c42a5	Joblad	S1 accepted
Stage 2	32fa192a-f26a-45c4-bb1c-44ce35a533ca	Last Chad	S1 accepted
Stage 2	a6265d43-324a-412c-afa6-07a7c391c774	Magma Market Place	S1 accepted
Stage 2	e7fcb59f-5cff-4565-9139-43b78d6c569c	MOM_AI	S1 accepted
Stage 2	22d95689-c528-4cab-828b-9508da21cb37	MoonRize Metagame	S1 accepted
Stage 2	48ea0a21-a007-4aac-970b-1822dac30679	Senatus	S1 accepted
Stage 2	8648dfe6-26b5-434b-b341-65467dd96118	Muses	S1 accepted
Stage 2	7711c177-bae8-4d02-8599-dccb01e779ea	Numbers War: Grand Drop	S1 accepted
Stage 2	3fd37bb0-54cd-43c8-af88-5c9bb3649848	ONCHAIN MAFIA	S1 accepted
Stage 2	13ef5e85-9c74-4cca-975a-5b4c9e58d816	OnChainBattles	S1 accepted
Stage 2	22d92244-390a-466a-93e6-eab3c712f951	Pagrin	S1 accepted
Stage 2	58bb7783-e0b9-4df9-89e9-a061f4469d9f	Paradise Arena	S1 accepted
Stage 2	2b435141-c78a-4ea9-a44a-6b9434cb4298	Peon Smash	S1 accepted
Stage 2	0e18ef84-7381-4238-968e-da6a3180b21c	PokerWars	S1 accepted
Stage 2	c811c915-09ba-4536-ac08-d49296da2134	Sapien Eleven Platforms	S1 accepted
Stage 2	2b953527-a36d-4a9d-8124-8c6076d792d4	Travax	S1 accepted
Stage 2	49bccd9a-afa4-457d-9548-6578e9a5b848	Whitepaper IQ	S1 accepted
Stage 2	dfeb395e-6859-44fb-bf46-dd86e78aa33d	OPENLAUNCH	S1 accepted
Stage 2	7b049c8d-1470-456d-a668-9060bc9682c0	Pact	S1 accepted
Stage 2	da22a3e1-3e9b-4343-bd71-58e1de45b1fa	EnergyFi	S1 accepted
Stage 2	96f23aaa-fe01-4c79-9ffb-96b1c5f235e1	proof of trust	S1 accepted
Stage 2	767c1113-55fe-47cf-9d4c-566cc7fc0d4d	PulseMarkets	S1 accepted
Stage 2	89b26393-967e-4c76-b2cf-924fe1e83caf	Reflex L1	S1 accepted
Stage 2	aa18466b-c5f0-422a-8374-5bff316dbca7	Rheon	S1 accepted
Stage 2	70a3a284-0263-4328-9baa-fb4828faffe2	Skepsis	S1 accepted
Stage 2	c1612e54-8c48-4c89-9090-4007be0f976d	SnowMind	S1 accepted
Stage 2	f19e406a-f88a-4aea-9b62-d3c75df82acc	Spinchain	S1 accepted
Stage 2	9d7d8ef2-ca00-4170-8378-321d9ec77038	Sway	S1 accepted
Stage 2	c3513966-66c5-4a10-b3ea-df6b1e52e92e	Sway	S1 accepted
Stage 2	cf87fdb4-ee17-47c7-9f0f-4671da296421	T3tris.finance	S1 accepted
Stage 2	7f99d1f3-1966-4c84-88ab-756611d912ce	Stabletown — CityChain Kit	S1 accepted
Stage 2	7e257cce-7e91-47d6-92d8-b52d5b70a14e	XPowerBanq.com	S1 accepted
Stage 2	9dcfd594-2779-47fa-a12d-2ce6a1e66177	AtomicHub	S1 accepted
Stage 2	32b21ee8-8c36-4dc7-81ba-84bfa7e9d76d	Bitju	S1 accepted
Stage 2	6a6679f7-4568-4a77-8256-b1e556850962	Fandomly	S1 accepted
Stage 2	d34fa092-33f0-4148-aef1-81850a0ae2ef	Grit - a unified crypto–fiat wallet built for Africa.	S1 accepted
Stage 2	b0336381-683e-4988-b14b-6cd9a710dc60	GRYD.FI	S1 accepted
Stage 2	73d3efbf-f4db-4965-8b3d-47f3fe5bd647	GUANXIpay	S1 accepted
Stage 2	299d52db-0432-43b4-9edb-ec9747a6747f	Habitry	S1 accepted
Stage 2	1ebadfe3-8d22-4fcb-9c84-66666c7c3064	Handshake	S1 accepted
Stage 2	ef1ca1da-35c0-4944-9352-9da3a0d2ce45	HODL	S1 accepted
Stage 2	df387eeb-ef95-4756-a95d-96f9cc03f82e	Kea Credit	S1 accepted
Stage 2	c1fa4142-ef9e-4d56-a928-cf1681f8f55d	Liffey Founders Club	S1 accepted
Stage 2	79c21409-a06d-4846-ad40-b84a435bb568	Liquidsat	S1 accepted
Stage 2	b1230c81-8cb7-4758-a55e-b14a63743c07	Lobster	S1 accepted
Stage 2	ebb5f676-2388-4e77-accf-1c23231c2e3a	Thermocline	S1 accepted
Stage 2	bc33ff91-8c28-4ada-bfda-e0534b087ead	Meta Pool	S1 accepted
Stage 2	a31cd077-bdb1-4186-885b-6e3aa1675638	Todin	S1 accepted
Stage 2	6b7d09e6-cd9a-45a9-9954-0eb6abbd0439	MiPool	S1 accepted
Stage 2	77524470-f5b7-4ad1-8664-5700078782dd	Paros — Institutional DeFi Execution on Avalanche	S1 accepted
Stage 2	ae1ac233-4c25-4ac2-ae6a-2e593db384fd	Trexx	S1 accepted
Stage 2	64431e38-0117-4585-b7cb-f5222d536f10	TRIGGER	S1 accepted
Stage 2	5c5b6208-31a9-4c68-b974-8d2d449ff6c3	Ping2Pay	S1 accepted
Stage 2	df095b40-4254-4d55-a32a-eb6817e0c1fc	Shards of Affinity	S1 accepted
Stage 2	c2fd4129-8d9d-4c47-a057-39640b87e342	tCast	S1 accepted
Stage 2	9945c41b-7ecb-4b64-8441-75215e654758	UGentos	S1 accepted
Stage 2	157311c8-8175-494a-a9f7-4e2d256be6f2	Wizard Battle	S1 accepted
Stage 2	1ca0d881-75d9-44f9-a24a-73f6dba83a08	XALLENGER.fun	S1 accepted
Stage 2	11c9128c-7bc5-40a9-8e89-b416d6041213	Zivy	S1 accepted
Stage 2	81f70556-9ffc-450b-a10f-57233100cb28	Valora	S1 accepted
Stage 2	bcb2eaa3-2632-4d2a-8d76-2154ada8dfc5	AdsWrap	S1 accepted
Stage 2	9d909f13-504c-45c2-b408-4ad63df89f83	AI-enabled Chain Abstraction on Avalanche-C	S1 accepted
Stage 2	70bc0a8b-fb7a-4dd6-a250-9fc37cb574a0	Arbi	S1 accepted
Stage 2	a5dc462f-405a-4ea3-92bc-5c1736a95e01	Arcgenesis	S1 accepted
Stage 2	0da87ed4-c25b-4661-96fb-5a91e70c1056	VexLand	S1 accepted
Stage 2	f5342123-0a95-4e18-a339-5c090df0fb34	Astral	S1 accepted
Stage 2	bbee9e32-c375-4e77-89da-af2dfad162fd	Warloot	S1 accepted
Stage 2	748b7784-05e8-43d7-b761-40df432ffbfa	AutoFlow	S1 accepted
Stage 2	e21910ab-9663-4916-8417-c72bdee40dc9	Avalanche AquaSpace Aggregator (AAA)	S1 accepted
Stage 2	ca6d3f2a-2559-4849-9552-86c30ac4dd7d	Bannerus Maximus & Tessera	S1 accepted
Stage 2	a630b2d1-bc07-45d2-a7ba-6d4553ec9434	Whispernet	S1 accepted
Stage 2	bf194c27-e078-4c43-a867-c35e6fed507c	ByteSwap	S1 accepted
Stage 2	ec7eb471-710c-4f03-96f7-3784d8a424a7	Heartel	S1 accepted
Stage 2	1f236b0f-104b-4e45-a620-e55ee6516002	Open Directive	S1 accepted
Stage 2	f3852880-bd08-4b7a-bda4-74583d001aec	proof of execution	S1 accepted
Stage 2	d8e52714-00c6-4ce2-879f-2205fa7f120c	QSTN	S1 accepted
Stage 2	33b3ad49-e0cf-4b32-ac22-28b7650974f4	Social Contracts	S1 accepted
Stage 2	88eca337-14e0-48ab-a8f3-15e016fb5220	Trustclaw	S1 accepted
Stage 2	52b5ebec-9dc6-4b5a-8656-b9be7b590af0	VERA	S1 accepted
Stage 2	e7edf718-a165-4baf-88ca-82aa3ea4f0c1	VeraFlow	S1 accepted
Stage 2	90e14fae-3727-4ef6-a280-4d1dcbdc6bdc	Veriwork	S1 accepted
Stage 2	7cdb40d2-749a-4d51-a207-27b8dd512b9b	ZeroX Protocol	S1 accepted
Stage 2	284d070a-13f4-4e75-bea5-109ee05b3f7d	Zelf Legacy	S1 accepted
Stage 1	3d5fe164-fdd8-4da9-9ab7-75e2670da1ef	8 Ball	rejected
Stage 1	0a7f727c-0fd9-44d2-a181-bfb9c37a481e	A0X Collective Brain	rejected
Stage 1	6e9490b1-4ee8-46d8-9336-6c61b1e5fab1	Actxion	rejected
Stage 1	78e525c6-51b0-4d9c-b6de-c1365a025892	Adreste	rejected
Stage 1	c11f3557-8741-4ac6-bc25-205d74db2b60	Aegis	rejected
Stage 1	88f5bb2a-0d1f-44ec-aa62-6335eec236f9	Aether Realm: Temple of the Fortune Sigil	rejected
Stage 1	c82abb42-c286-4145-8ae7-ea38aa8e05a8	Agent Arena	rejected
Stage 1	e478c261-9f1d-4763-9d4a-cc16e28afbb0	Agentity	rejected
Stage 1	1081bda1-87b6-4b30-bcd8-565cdf1b6126	AgentPay	rejected
Stage 1	71575c54-3259-4e3b-8409-8470b12fcff5	aicall.tv	rejected
Stage 1	0daf0480-46aa-4741-b8d9-60f7707aa15e	Aidra	rejected
Stage 1	82e2cd33-3a3f-4f36-9154-e420a06f0853	AITarot-OnChain	rejected
Stage 1	7fc2ea7d-af5f-4eab-8eca-49b93121bf24	AIvana	rejected
Stage 1	6ae3fa51-b54f-4086-907b-3a1927685091	aixles	rejected
Stage 1	43cad54c-570c-41c6-b5b8-d3ca07c57ff6	Ajna	rejected
Stage 1	2e14aa2f-75f5-49a0-b980-b42214291af1	ami	rejected
Stage 1	382346ed-cdfc-45c6-9beb-db1d876d554c	Anamnesis AI	rejected
Stage 1	1ab9b84f-8993-4802-b6d1-6e7102b5e342	AnchorProof	rejected
Stage 1	025acab3-a6ce-4a79-99ef-805c140eafee	anDao	rejected
Stage 1	567050a4-d44a-4285-87c5-8df6e6679382	Aneroid	rejected
Stage 1	52908d0b-cfdb-4c01-a5f9-bc9ad1499773	ANIMA	rejected
Stage 1	08adb9d3-f800-4570-b0b0-1ec0cc9a4c5c	Any Result Yet?	rejected
Stage 1	9f401333-e22c-465b-89d6-ec3ba203711a	ArcadeOS	rejected
Stage 1	05b67fdd-235b-4628-b461-953c1c9f59dc	Arcadia	rejected
Stage 1	8db3a7a0-a858-4be3-9544-aa934d544acf	Arcane Pool	rejected
Stage 1	5c375723-8b28-4ce1-870a-2d33ee70ec00	Arena Fi X	rejected
Stage 1	cf7fcdf5-6e37-429b-95ff-e782f12fa18b	ArenaLive	rejected
Stage 1	0da6adb5-2a6b-4137-a301-8483c3cf26a4	arXiom	rejected
Stage 1	c611357b-a322-4c3b-bdfb-74ddb071bedf	ASCENT	rejected
Stage 1	1b0737aa-e49e-40c8-b247-93e04b11f473	AssetDexter	rejected
Stage 1	0cb34dff-51f8-4e8e-b04b-fecd0c92f044	AssetOracle	rejected
Stage 1	c81a8e60-926c-4435-963c-e365502cbae0	ATOMx — Autonomous API Payments via x402	rejected
Stage 1	20175349-13f4-4cdb-849e-863f136a4d93	Attest	rejected
Stage 1	e9f1d297-390c-40f5-b68d-81f2e8b70aa8	Aura	rejected
Stage 1	f812fddc-2608-436b-a438-2436b78b3b40	Auricle	rejected
Stage 1	9fac4d50-01ae-42fc-a7c7-24d8a1da149d	AutoYield AI	rejected
Stage 1	52de7618-2ef4-4be4-993c-590d58d5f241	AuxoLock	no S1 verdict
Stage 1	3ba15cf7-534a-486a-bba2-34176662a8d9	Ava nursing code	rejected
Stage 1	241a0d85-26b2-462d-94f4-30b87df33bcd	Ava strike	rejected
Stage 1	bfb91d66-c884-4f99-aab5-cd4668541f67	Ava Studio	no S1 verdict
Stage 1	92dbb69a-b570-4bb9-bfb9-7e0230666896	Ava-Echo: The Infinite Mystery Engine	rejected
Stage 1	fdaa603d-38a5-47f0-b5ee-a407f0074720	AvaCertify	rejected
Stage 1	7efe6ac3-e1df-4cd1-8dfe-bbe604692248	AvaDotSus	rejected
Stage 1	6617fe51-fc76-425e-b6a3-a5cd165f7a8e	Avalanche AI Explorer	rejected
Stage 1	982b17da-b5d1-4fb3-9803-8567734140cb	Avalanche AI Subnet Sentinel	rejected
Stage 1	7c1a1c2c-6451-4626-8adb-3daaee12a9a7	Avalanche AI Workflow Engine	rejected
Stage 1	f717e61d-58c0-4891-8132-143cc7c5e548	Avalanche Arena	rejected
Stage 1	3eaab430-660c-4984-9bf3-66f1772484aa	Avalanche Arena	rejected
Stage 1	368637a9-04fc-403b-b4da-2717a9dc5627	Avalanche Diner	rejected
Stage 1	03a6e337-5d01-4e30-b2a7-c025da6cc014	Avalanche game zone	rejected
Stage 1	bef258f0-1ba7-4381-9eda-65ae8f9843ab	Avalanche Gas Tracker	rejected
Stage 1	1091c641-bac0-46f1-a13c-07708334a1c6	Avalanche Proof of Effort	rejected
Stage 1	c0f08166-3d2d-4f4d-bb2f-dc87c5082d7e	Avalanche Proof of Effort	rejected
Stage 1	7299ccd0-baba-45d2-ba6b-0995f422e3c8	AvalancheArcade	rejected
Stage 1	274f79d4-39f8-4cc0-871a-58dd7d2356c2	AvalancheMini	rejected
Stage 1	efd665e7-c0bf-467d-9eb5-81a53821e633	AvalancheParty	rejected
Stage 1	ca12f6a0-81bc-437e-955c-26661aa15aeb	AvalancheRun	rejected
Stage 1	168d396c-3358-4ed3-996a-d76908ab1b26	Avalanchmentzz	rejected
Stage 1	48a88d08-34dd-44e6-8e48-84f96d4d7fcc	Avalink	rejected
Stage 1	c18ec105-b321-4fee-a3d3-9cd85bdbf021	AvaLink	no S1 verdict
Stage 1	51749466-e2d2-4248-914f-e113e0d468ad	Avalon	no S1 verdict
Stage 1	a3a3b1bb-c4a9-442d-b576-bc148a037e90	Avalon Games	rejected
Stage 1	a7958758-1dc9-47ef-88a4-14b671a7bcb5	Avalon RIft	rejected
Stage 1	699f4703-d73f-4c69-a119-f921a6b6fa9b	AVALON: REAL RUN	rejected
Stage 1	7edda5b6-2c3c-4714-9b6c-b2322488cb44	AvaLove	rejected
Stage 1	0e9f8946-90ca-49c0-8684-8c5bc98981e8	Avapotto	rejected
Stage 1	d880eb00-d6ee-4864-a142-d0314bb25daf	Avaren RPG	rejected
Stage 1	b6718b01-2a74-444f-9908-a11f4716242f	AvaRide: Urban Territories on Avalanche	rejected
Stage 1	8140af3c-9ca4-4955-a76d-048c29b736c7	Avashell	rejected
Stage 1	6ad5efeb-5326-45ae-a711-8340c10607ad	AvaVerse	rejected
Stage 1	e530ad81-37ae-4878-b679-8f662b2943ff	Avax Hypercasual Gaming Hub	rejected
Stage 1	4e8a78a3-0367-40ab-af0d-d7134f33b29d	Avax Kart	rejected
Stage 1	1a1edf3a-4674-4598-b034-4b3a213f82bc	Avax Ninja	rejected
Stage 1	f4453111-1812-421f-b425-56b33efba6c9	Avax Vanguard	rejected
Stage 1	113ffd08-c124-4ce7-83ef-4b969125080f	AVAX0 (AI-Driven Avalanche Infrastructure)	rejected
Stage 1	ffe29397-84cd-479c-846e-256d561909d8	AvaxBench	no S1 verdict
Stage 1	fbf880ee-6a58-4782-b7d0-8d83a15905c2	AvaxFy	rejected
Stage 1	18250097-9806-4d90-81d8-8bd4bff0f6e5	AVAXIO	rejected
Stage 1	73727791-404c-4437-9aa4-7bdbb696e4a6	AvaxPass	rejected
Stage 1	eb5283e5-5e7a-4f09-a33f-60467238ab92	AvaxPixel	rejected
Stage 1	9c8094df-cbef-4c8c-8f99-4017298d952a	Avx.exe	rejected
Stage 1	5ce69742-a4e5-4fa6-a2be-918b842f8d9a	Awareness	rejected
Stage 1	0118e18c-b9ef-4638-9dc6-0df132ca3111	Awareness	rejected
Stage 1	1fa24cce-70ea-4fe7-8b10-7707cbe1aa7c	Axon Move	rejected
Stage 1	56a3b157-82d7-4704-8f7c-f38c70c588eb	Baits and Paws	rejected
Stage 1	08cfd84a-0580-4a57-9399-64e738609ae3	Ball’s Path: Rolling Chaos	rejected
Stage 1	f6302bfe-8a8f-45cd-bb14-c427ad2a9a27	Bambalam Wordle Challange	rejected
Stage 1	85656751-6396-47fd-8a3a-1c521437e3d2	Bannerfall	rejected
Stage 1	085efbbe-f4ba-4b71-b748-f6384a2075b8	Bastion Protocol	rejected
Stage 1	dbc3c13f-f6d5-4f3c-8605-05519560437c	BCK Collection	rejected
Stage 1	da7660cd-6461-42b7-a921-cbb7234ad668	BCMDAO	rejected
Stage 1	577e239b-d5c1-4260-acc9-aeed6f7737e8	Bears and Salmon	rejected
Stage 1	2ecb5582-7fff-4dca-a5dd-0efe460cacac	BeatBrawls	rejected
Stage 1	498f1e4c-d701-4484-aaff-af9d1705e4e1	BEDROCK	rejected
Stage 1	0b99022f-eedc-491e-909d-54820782eb48	Bet4U	rejected
Stage 1	9d6371ba-4ae1-42bb-8906-191ee2bacf29	BetBrawl	rejected
Stage 1	c1704744-af0a-40fa-9d82-42a5db7d4676	Beyond Service	rejected
Stage 1	446832d7-b1b3-42ed-bad5-c3484d3652f0	BG Test Name new project	rejected
Stage 1	a2800091-bf4b-4ec1-aca6-69581459f0ab	BIG FISH Race CO	rejected
Stage 1	2d82c614-a8e8-4d73-a0b6-c8a7e1f90e9c	BlazePay	rejected
Stage 1	99e4094a-1402-4e70-b0f2-23d15fbc5882	BLINK	rejected
Stage 1	355f052d-634d-40fc-9313-fe40102126fc	Blocera	rejected
Stage 1	9146ac78-4209-4038-b898-27bf0ae75692	Block Tides — LUMINA	rejected
Stage 1	09c6061f-d15e-4829-9525-c3f69234690a	BlockBlitz	rejected
Stage 1	d9b7afac-9e17-4e2a-b98c-8d8a93f35a64	BlockBrawlers	rejected
Stage 1	f4fd56ef-a584-4396-a10b-e318e797bce2	BlockLegends	rejected
Stage 1	4ab6fa66-90ce-45c8-8f35-b1bc9834505c	BlockQuesters	rejected
Stage 1	aebd2bb0-e8b8-4dce-9764-38855a9ad2e6	BlockRaiders	rejected
Stage 1	3f86c8b0-3474-4e27-a861-6b1f36074101	Blood Banner	rejected
Stage 1	515d6e16-7932-4a76-b0a4-50663c313aa1	Bogo	rejected
Stage 1	533ab41e-6aee-488e-a916-d1fedca0ea9c	Botz-UP	rejected
Stage 1	8312b8dd-797a-4627-b43e-90c749718bd8	Bracketabra	rejected
Stage 1	5caa18df-2ed7-4885-8c0f-22984d3e1d15	BrandOS	rejected
Stage 1	5ce7a99f-8cb0-405a-862e-4819e0a69a15	Brendly	rejected
Stage 1	06d328cc-0248-4ff2-a2f7-f29c9c9a5143	Building the Truth Economy on Avalanche	rejected
Stage 1	a99719fc-fae2-4bb6-852f-0a27f0e7291f	BurnBoard | Trust-Scored Burn Analytics for Avalanche	rejected
Stage 1	fe9d9c31-7eb3-4431-a3b6-d7a216bf0497	BurnerChain	rejected
Stage 1	4f765949-94b3-4fda-9774-d01b3655a8a2	C.I.C	rejected
Stage 1	d793efe9-598f-4ce1-847b-45e270197f3d	cadtail	rejected
Stage 1	41909de4-adc4-4202-9f93-23e5704bcf79	Candoxa	rejected
Stage 1	ca9ecf16-6aa3-4aac-b5ca-efcab684c6aa	CardMancer TCG Tactics and Unity Schematics Toolkit	rejected
Stage 1	ba1158f9-36b7-4930-aae7-c7ca0b37250c	Cat & Sword	rejected
Stage 1	0a0f9b70-fa36-49be-9bc1-5f33647fcc47	Celar	rejected
Stage 1	d8784dce-a40e-48d1-b323-af54fe7580cb	Chaapa Ride	rejected
Stage 1	115becb8-ab70-4329-8078-784a9c8dd475	Chain Isles	rejected
Stage 1	82c1e1ab-fa43-43f0-aadf-ff6fc79ef61a	Chain.Love	rejected
Stage 1	6918efe9-763a-42b8-88d3-e2a1ce27e0c0	ChainArena	rejected
Stage 1	2985e85e-cb4d-4b6b-a267-deeebb1395c5	ChainBounty	rejected
Stage 1	3fbe0ad4-e504-45c0-b68c-3245290a150b	ChainCaster	rejected
Stage 1	3a97ac0b-d1dd-4e8a-838b-d4228f09e0c2	ChainClash: Skill-Based PvP Arena with On-Chain Reputation	rejected
Stage 1	b110737d-297d-4ff8-bf50-4384895d1d93	Chainguard AI	rejected
Stage 1	d38ec6ab-f146-49ad-8886-db0723d52a9a	CHAINMIND	rejected
Stage 1	eca42c51-ebad-4862-9bbb-6747c83a3dd5	ChainQuest	rejected
Stage 1	7a527eb3-e454-4b8f-b4f3-78e0a9c94c48	ChainQuest	rejected
Stage 1	3c43c6a0-ce8a-4728-bf4a-a18c68330994	ChainRacers	rejected
Stage 1	d0765963-3c64-4856-8194-d8ca6de6b047	ChainShift	rejected
Stage 1	63a11f84-559d-423f-a706-acadf17cb5b7	ChainSight	rejected
Stage 1	d9203132-bcf6-46e2-bc1a-ca2d38e768b4	ChickenCoop	rejected
Stage 1	9aa668b6-9530-4fee-b825-f200c120df12	ChillClick	rejected
Stage 1	5377d5fa-5e81-4144-b935-3bf96eff424c	ChillQuest	rejected
Stage 1	2672b9a9-67ae-4a9f-bb69-a7fffa254345	Chimera Forge	rejected
Stage 1	d7ee3b4b-3107-4737-9606-47abb21e8b29	Chip	rejected
Stage 1	ed285899-6995-4e4d-90a0-d9fcdc92ad58	Civilization Ledger	rejected
Stage 1	552c512c-d15c-4c96-b039-436ad084babd	Clash FIghter	rejected
Stage 1	cb468035-b0be-4e07-8c8f-b991afa33d78	ClawMatrix	rejected
Stage 1	c04d9a45-3f85-4d85-b729-261725e97ba5	ClawPlay	rejected
Stage 1	a86add69-cbbc-4294-aa0d-cfcaf3483cfd	ClinConsent	rejected
Stage 1	111cf324-35be-42df-86e9-734b123a2902	CLIP DAO	rejected
Stage 1	634ed2e5-3045-47f2-bdb4-d4bfef033d17	clipbolt	rejected
Stage 1	7fefa0d4-0597-4e83-88f7-99c3c1296026	CloseLoop	rejected
Stage 1	cd2d1c8a-4adc-4536-ac0d-26af21837e50	Clout	rejected
Stage 1	d14928e8-0d59-4ac5-9cf4-3a080d8701d9	Coal - Programmable Commerce on Avalanche	rejected
Stage 1	fa9daa33-8bfe-4499-bafe-0f6c52a82767	Code Impostor	rejected
Stage 1	511439f5-d3ad-4092-84cb-672a3c659b2e	Codex Eternum: Eternal Souls	rejected
Stage 1	1fb41fe2-a0dc-44d0-8323-976bc35df4d0	Coffin's Oath	rejected
Stage 1	d1a74789-02c1-48e3-90da-cce36b35945b	CogniShield	rejected
Stage 1	6ece78f6-8043-4085-8281-fc380a33d8cb	CoinCreate	rejected
Stage 1	b04c53e1-d395-49b6-9502-f4ba64641f41	Cointegrity - Institutional RWA Marketplace	rejected
Stage 1	f32576c1-aa77-4515-b439-c8e74e1ec47b	CollabOS	rejected
Stage 1	df16a448-c7ee-487d-bbc8-42044b3f1eae	Compass AI	rejected
Stage 1	50147ffa-f173-4ece-8d4f-535d34fb8974	Competitive Puzzle Arena with ELO Wagering	rejected
Stage 1	340e2346-80ce-4116-969e-4be9e89c0c50	compose.market	rejected
Stage 1	dbe026d9-d107-495b-936a-d19599123cb9	Compute futures exchange	rejected
Stage 1	6002c0f5-cce5-4cc4-bde4-9a43396cb110	Conquest.eth	rejected
Stage 1	15822ffb-f318-46dc-81ad-02694a8df591	CONTINUE	rejected
Stage 1	7c5cb43c-c63f-4636-bae6-861df3915aa0	ContractShield	rejected
Stage 1	f3ab4150-afc0-43fd-b32f-d8335df959a7	Cosmic Surfer	rejected
Stage 1	7aa8b39d-db72-4cb0-b691-284b7c6e8fa6	Covantra	rejected
Stage 1	639c0df2-3e40-42f5-87f5-dceb16af4351	coworking-minions	rejected
Stage 1	cc4f2df3-6dd9-40ff-844c-27e2eb76c837	Creator Founding	rejected
Stage 1	42665373-bc37-4ff2-928a-4bb1d1d574f1	CredForge	rejected
Stage 1	b617545b-0f8e-4cc6-af1f-935606d5add8	Crime	rejected
Stage 1	fa488a86-04d1-4945-99f4-0fc2a2527940	Crownforge Chronicles	rejected
Stage 1	ebe25830-dccc-431f-9463-bc20e246d7f0	Cryonex	rejected
Stage 1	289a6e48-f57e-41d0-b655-9e0fb68dbaba	CryptoClash Lite	rejected
Stage 1	ea02e014-bb31-457b-ac03-ca8f4498e821	CryptoCubes	rejected
Stage 1	cfd4cd43-3bf5-464c-a18f-87e81c1c3f84	CryptoRaid	rejected
Stage 1	dbab33a3-7e00-4bdf-8c89-8ce654d23b1b	CryptoSprint	rejected
Stage 1	f1422c96-97ed-4d31-a457-1e7265d6699d	Crystal Clash	rejected
Stage 1	7b02df95-8d6b-4a61-a504-ac01f88a01af	DAO Ops Stack	rejected
Stage 1	f60baa66-1832-4bc1-af37-f6a4dd899f89	DAOSense AI	rejected
Stage 1	f082cf61-dd14-475e-91d9-9fc0faae8599	DATA2073	rejected
Stage 1	f070e0fe-c25f-426a-93ca-ebbf05fa9d87	Datamine	rejected
Stage 1	da2e17fa-ec9c-4064-8352-68434b35e3b2	DC Agent Audit	rejected
Stage 1	a383c65b-3220-47c6-a44c-5ca3e0429213	debonk - shoot or die	rejected
Stage 1	c44c2876-1e4b-467c-ba03-7638de0eebb5	DeFi Orbit	rejected
Stage 1	9b682d65-3bf3-4a4a-9708-2d6ef83aff4e	Degen Survivor	rejected
Stage 1	b90de925-a352-45e6-950f-c2c8c8c88ad8	depick	rejected
Stage 1	c3da2093-4363-4841-b55a-e0f9e027bc46	detectable addresses	rejected
Stage 1	0d9a4ae2-958f-4c1a-b695-089e5db9df69	Devil's World	no S1 verdict
Stage 1	54b2323c-a076-46a3-8d80-77dff4772a10	Digemart	rejected
Stage 1	744e009c-7718-49ec-afb7-78fdd7015c19	DinFI	rejected
Stage 1	f89c5371-0f14-4ffb-bd54-92ec32bd47e5	Dinfi	rejected
Stage 1	cc57acf9-0fc4-4712-ac71-9f5e9f37ac7f	DiRacing	rejected
Stage 1	5ada60fe-cf5e-4e1a-aaea-3d455697a7ea	Discovery Ad network	rejected
Stage 1	ded4569d-4bc2-49de-a1d1-921726c536e8	Dive In	rejected
Stage 1	ff556497-838a-435e-8692-87114a1fbf46	Divergent Finance	rejected
Stage 1	729c34b5-e725-438a-9882-61b037198ad2	Drift	rejected
Stage 1	c259e6d9-d9c2-4fd4-a55d-235e59c7dca3	Drift	rejected
Stage 1	ae6ddb94-06b2-40c3-9b01-2a1cd9fd1870	droplinked	out of time
Stage 1	ab85c4ab-3716-48c0-bc5d-802702ed7296	droplinked	out of time
Stage 1	4d0aca01-b187-49ec-9263-ffb49d1818fd	DUNGEON CITIES	rejected
Stage 1	692dd5ce-9ac9-492b-9dc2-69a7799f2f11	Dungeon Crawlers of Daggereth	rejected
Stage 1	a14592b4-827d-494a-8004-2b5ccee9cd98	Dungeons and Games: Chaos Protocol	rejected
Stage 1	371dfca4-abfa-4cc8-8c44-0d1490e93d84	EchelonDAO	rejected
Stage 1	b1fbcd93-5e95-480f-bb95-731980b3db86	ECHO	rejected
Stage 1	7abab3e6-77b5-4816-b55b-bfe6bf32eec8	Echoes of Mantra	rejected
Stage 1	15b734cc-dad3-4d4d-9b11-882afe0c7782	EcoForge	rejected
Stage 1	7390671c-6e90-49b7-9c03-0b7760a28499	EcoPlay	rejected
Stage 1	9ac42de6-0cdc-4cb4-b195-50d24a642721	EcoRWA Tycoon	rejected
Stage 1	ce296854-eac4-4f3c-a7ae-47d8bf0b22fa	eeyyaa	rejected
Stage 1	7b4731b6-2f4e-40eb-ae4c-ae8ae56fcbb8	EffortX	rejected
Stage 1	c844d2cc-8bd1-44dc-a5e6-2ee812cee03c	Eliezer Suite	rejected
Stage 1	b9fbb95b-de8d-44fa-8827-25983a1da0ae	Emotional Delay Protocol	rejected
Stage 1	8ba9f104-b580-4f9c-ab59-39a912673d9d	Enerchain	rejected
Stage 1	6a5506d0-9482-4098-87e2-9049020651b8	EngiNode	rejected
Stage 1	508429b5-a890-4acc-ac36-2c413728eaae	Entangle	rejected
Stage 1	10c2f6fd-7f6c-4cc7-a87f-3eba94f988a5	Epoch21	rejected
Stage 1	c0cde4d5-25c6-4dea-9da7-19b5fe8b7a6e	EPROM	rejected
Stage 1	bc256cea-17c5-43c9-9065-c2e6934086c0	Escrowly	rejected
Stage 1	a1a85205-aab9-4e79-8b39-d14baa3f8214	EstateXchain - Tokenize, Fractionalize on Chain	rejected
Stage 1	23ef2084-b35e-41a1-850d-0d5a5ea66517	ETO ( Entropy To Order)	rejected
Stage 1	c8d4f0ee-d310-407f-a831-04618556a3d6	EventAtlas	rejected
Stage 1	b7341587-7399-457d-89ff-60267bf6eaaf	Eventcrib	rejected
Stage 1	280fa959-65b0-47a1-9e55-ce77aa40a135	ewf	no S1 verdict
Stage 1	7487b7ae-7a29-437e-b4c5-898fc3e293ce	Exmarket	rejected
Stage 1	23b70dea-3a8e-4ff5-ac3b-ba811040d929	EXPLOONA	rejected
Stage 1	a7b1564d-817b-4dda-8733-4b7bbd72694c	faceless (x.com/facelessnft)	rejected
Stage 1	3737557b-7c1a-4b0a-9b98-9926c6598add	Faded Monsuta	rejected
Stage 1	a470c308-a595-4ec9-b4e0-ed19f263a2f8	Farmstedia	rejected
Stage 1	5ecafa7b-1bc4-4e22-afaa-2c4b01da86a4	Fatal Track	rejected
Stage 1	fd671463-ff64-449a-952c-65cef04fa32e	FaucetDrops	rejected
Stage 1	a9bebcd9-4723-478b-948b-ece0a1ecc6ed	Filling game	rejected
Stage 1	a9f9f81d-4c84-4a12-a819-2e04c33bec6a	Fist Commerce	rejected
Stage 1	40961ea6-3364-47b4-b375-cc670af47e60	FlexxPay	rejected
Stage 1	3f28d919-c5ac-412a-b24a-14957f1f746b	Flora Alchemy	rejected
Stage 1	09335d42-6623-4b85-ad35-8217865575aa	FlowFi	rejected
Stage 1	b512fe2a-6263-4514-b9d5-212b8c3263c8	FlowPay	rejected
Stage 1	d1d752c2-28c0-4096-bd60-58cfb68bcd3c	FOLIO	rejected
Stage 1	a2d6ed21-29df-4bfa-8c9c-3b529d2b7e54	ForgeNet	rejected
Stage 1	41e2711f-ffca-4fe0-8789-bf6419dd9106	Fractiva	rejected
Stage 1	f95031fa-4bc9-452c-a94a-07bdd3c9f76e	FRAM	no S1 verdict
Stage 1	d606df43-9e00-4cdb-b6d3-6837d99e441a	From Seed To Harvest	rejected
Stage 1	c2effcd1-3c94-4c0f-b562-c816cc8667d3	Frost Games	rejected
Stage 1	4291ee5d-7fbe-4e91-80e2-334093809b13	FrostArena	rejected
Stage 1	3bc8b00e-9b02-4991-ab42-9359c1db4a3a	FrostBattles	rejected
Stage 1	c9e5650b-c540-420d-adbe-3738336278dc	Frostbound Arena	rejected
Stage 1	43cd17ec-c293-44ac-9da6-10b0884d4b11	FrostCore	rejected
Stage 1	7062f507-0f00-4249-81de-cd264e5a108b	FrostFight	rejected
Stage 1	2dcd82ed-4504-4b42-8c9a-1785a005bea2	FrostJump	rejected
Stage 1	a78f11aa-952a-4336-9817-30d502852b6d	FrostQuesters	rejected
Stage 1	84775e77-79a9-4a18-9918-7c0157ebc025	FrostRaid	rejected
Stage 1	d889a0e7-3f0e-4a49-b152-239c5e6b0f63	FrostSurvivors	rejected
Stage 1	ae5ee2dc-832a-482b-8a58-52620aa8a187	GAIA	rejected
Stage 1	36974a8b-9f9a-4abd-b479-a24c1835f7a7	Gaia's Ledger	rejected
Stage 1	f8a3b0c4-c80a-44e2-8526-8d3846ab6704	Gally	rejected
Stage 1	41b6b324-922a-4ee2-ae8d-7e4b55f31aa4	Game of Trend	rejected
Stage 1	a41b08ce-e1bb-4f27-ae8e-031daa1cfc46	Game of Trend	rejected
Stage 1	4516bb17-10f9-4848-93ff-18e091567653	GameChanger Marketplace Tool	rejected
Stage 1	194363fb-f164-4d68-a285-e00c31970e1b	Gameon Finance	rejected
Stage 1	e6405525-c44d-4768-815f-c2adf3dfbfe0	GameVibe AI	no S1 verdict
Stage 1	e2589d20-321a-4723-ab7f-81d2f62c0c4d	GANZO	rejected
Stage 1	33e9aed5-349e-42fb-8d13-caa205f85c86	Gasless Glory	rejected
Stage 1	9e92104c-4dd8-4881-bf50-03e7fda0f621	GemQuest Chronicles	rejected
Stage 1	6622dfeb-0af0-4c67-bf4c-708a263d0c35	Genesis	rejected
Stage 1	88b9b4ec-0758-45c4-b9b3-8b951022c2a7	GetADemo	rejected
Stage 1	572ee62c-bbcb-4b99-944d-a85b77a3a120	GhostPay – Privacy-Preserving Payments on Ethereum	rejected
Stage 1	12f1f364-d3df-48aa-baa4-750bf3b0b4ea	Git-bounty	rejected
Stage 1	76cf46c8-10e1-42d8-a3f4-4c252b771fcf	Giza	rejected
Stage 1	077b51f2-1e5c-4dd8-8717-d6c0d472c3ba	GLEE	rejected
Stage 1	94109e5b-b68b-4caf-9994-8016f34af94c	GOATED	no S1 verdict
Stage 1	0a8fc9f3-10a0-4921-a95c-4e09a1c7f500	grandience	rejected
Stage 1	226b1bad-9210-4410-b4df-06be84c124a8	Graph Arena	rejected
Stage 1	7c769f80-bfe7-4378-952f-277fb2216e4d	Green Fuel Protocol	rejected
Stage 1	2e9f4c2e-b37e-47d6-9fa3-4a70fb4c3cfb	GRIDZ	rejected
Stage 1	b9b0d435-182a-4af5-b93f-e7a8df6f069b	Grimwave	rejected
Stage 1	24850a1c-70b5-4946-9bf5-9f70796e405c	GTU Dao (University Layer for Web3)	rejected
Stage 1	88b26d35-f348-42a8-abb1-d33fbf85b016	HashDeFAI	rejected
Stage 1	e735c594-63e2-4fc4-903e-4d7bc16f5fcf	Hashmark	rejected
Stage 1	a01de570-c21a-42ca-9f96-61ba8be6047e	Healing Connection	rejected
Stage 1	55c1d41e-0090-419d-93a8-4e40ce03d336	HealthChain Vault	rejected
Stage 1	7d5a3431-ebb9-4953-aff6-bc8b6d4794ad	Heights	rejected
Stage 1	dbf98b00-0a84-4715-8708-caa91e7ab2e1	Heights	rejected
Stage 1	05d1adb8-a122-442f-9d12-68361a6a5a9e	Helioras	rejected
Stage 1	e172bf30-8665-466d-9bfe-ab179477a737	Helm	rejected
Stage 1	de69d8ed-800e-4a35-848a-f9e557d3fee3	Hex Duel: Neon Protocol v2.0	rejected
Stage 1	09e4f773-48de-48ab-ba28-1c0e56640408	Hidden Wallet	rejected
Stage 1	d6690fc2-456a-4e9f-8956-de2b7868c3c6	Hide or Die: Save Your Village	rejected
Stage 1	0a1265c6-400b-4679-a3db-f1f7656e2985	High Noon	rejected
Stage 1	fff0ebe9-c789-43a8-af2d-ca02e0c332cf	Horshare	rejected
Stage 1	6b3461aa-794a-436d-a2b8-22f3cf2991b6	Huaritoken	rejected
Stage 1	605b6dce-7a18-4b58-a081-e1395f3393b9	HyperArena	rejected
Stage 1	f20fe2e4-27ca-4b0b-b359-bafa8c7281ae	Hyperkit	rejected
Stage 1	b63d422b-0a44-457a-9418-1f677a03f722	HYPERPLAY	rejected
Stage 1	1c1e27da-cc87-49f5-b4e8-3709be5bf98f	Hyvve: Infrastructure for AI agents with autonomous wallets	rejected
Stage 1	9baae432-124f-4d84-8fd5-762392ad66d2	I-RunZ Powered by Saij.ai	rejected
Stage 1	2e669aef-3592-4dc3-af62-4d75651f2b3b	IceClicker	rejected
Stage 1	ef2a4fa7-f24c-40fa-96bd-01a8f69fb1ea	IceDuel	rejected
Stage 1	c0f21153-216c-4916-b773-9b2370266b71	IceForge	rejected
Stage 1	9720502a-9eba-484a-aa09-c905db0fb099	IceIdle	rejected
Stage 1	8a40afd0-f121-491a-8680-bd0693adab1e	IceLoot	rejected
Stage 1	036933f2-64e1-4330-9c54-9943ec41bd2e	IceRealm	rejected
Stage 1	f4a3842b-a6e3-414a-93c1-ea37e236ec54	Identity Heist	rejected
Stage 1	aec6bb9e-1e90-4ed1-981f-df9163acb27f	iDos Games	rejected
Stage 1	d4e846d6-81c4-46bd-a7e4-f1d556e4b4a3	IgaQuest	rejected
Stage 1	b025588d-3a45-4850-91f9-587470189cb9	Imaginus	rejected
Stage 1	95e4ebff-1734-4f8f-8f89-900dee230260	ImpactChain Studio	rejected
Stage 1	3225c232-1aa9-4693-a188-3d2bf2a11caf	Incure	rejected
Stage 1	8f206f38-cba0-4fa9-a4e2-024f0a5d9860	Infinite Garden Ops	no S1 verdict
Stage 1	0ba311c5-5536-4222-ad94-fbd2ee16e429	Innovia AI	rejected
Stage 1	7a6bd164-217e-47dd-8c4f-bea3185be2a6	Intent vs Impact: A Game of Communication Breakdowns	rejected
Stage 1	b42df348-5c7e-4e68-a8eb-aee93832815c	IntentGuard	rejected
Stage 1	8f2278c2-f309-46f4-9f46-93b76bd2e160	INTERLOCC Protocol	rejected
Stage 1	4da66643-531b-4f45-a9c0-0eb1328c2001	InWINtory	rejected
Stage 1	bab92fe0-81e5-4617-a666-ac90e0491c66	Irion	rejected
Stage 1	b0fb55b5-834c-4a1d-bb00-11d4cb5ebe00	Ivuku	rejected
Stage 1	f4e9d2b7-7aa9-4aeb-8c62-660cd33b7def	Joinn.io	rejected
Stage 1	2c2d4272-82c6-472a-83c2-7ee5c0af9f69	Juicy	rejected
Stage 1	54bc617a-9a12-47fa-90b4-f82405391ca9	K Connects	rejected
Stage 1	694399b5-213b-4827-993f-5d31952f4869	K.Y.A - Blockchain Agent Bureau	rejected
Stage 1	3591ddc9-ff37-4e0c-a547-88f1d0a616e3	Kadro Tamam	rejected
Stage 1	cd31b703-71b0-4714-9589-4067e3ab0c0a	KAIRO	rejected
Stage 1	648fefdd-a71d-4eae-858b-1d2950628a82	Kamui	rejected
Stage 1	41f18378-ed0c-4fe5-b107-3ecd707b221c	Kickdom	rejected
Stage 1	8fdcbc17-e6dc-462f-9d70-6349dffe71a1	Kiooverse	rejected
Stage 1	50185445-a013-467a-8722-4bf2bbeb41f6	KnowX	rejected
Stage 1	15e4b352-a693-43a7-88c9-550790d13373	KnowX	rejected
Stage 1	4dad4fb4-7ade-42f2-ae9a-314b67c20bf0	Kryos	rejected
Stage 1	7f80ce5f-75aa-4ab6-b22b-fe9e4046c3f1	KubeRemedy	rejected
Stage 1	18d3b772-ede8-4e11-ba88-fdc52ba9b998	KuberX	rejected
Stage 1	4d98d08d-949a-4c60-8d47-89bdac591145	KuvarPay	rejected
Stage 1	4b5f30f6-46ed-4ffb-870d-803c63d2f107	Last Protocol	rejected
Stage 1	bfffb2a1-0ae8-46c4-9ece-ca063b2d39d5	Ledgr	rejected
Stage 1	d63dcaa7-2d36-4e49-bfa7-1bacf1c4276e	LegacyGG: Gamefied Hub	rejected
Stage 1	e2567760-5de5-4136-9394-35e738d8ae1a	Legend Of The Saints	rejected
Stage 1	468c609b-3292-45f5-a6d0-f5cfd461a957	little raccoon 4v4x	rejected
Stage 1	2faef5f5-e497-4158-87dd-e8027967fe58	Llama's Souls	rejected
Stage 1	0b12e6c8-0982-4c52-980e-d616482eda98	Lock In Protocol	rejected
Stage 1	b54c1660-4d9d-493b-aef2-2b906e7817ce	LOCKTURN	rejected
Stage 1	e755253d-e37a-4214-b86f-2de35eb1bb18	LOOM	rejected
Stage 1	4cefbcae-36b9-42e4-b270-0e68a00b357b	Lottery App(also known as Crystal Chain)	rejected
Stage 1	52f0515d-e66f-44f8-b837-5cc8fca39dad	LunaVoir	rejected
Stage 1	78e51474-3f49-468b-ad66-4892816f9238	M-SCI	rejected
Stage 1	9cbe4901-5c78-49e2-a180-c41c0acdce46	Magma Rush	rejected
Stage 1	37775056-1acf-4009-973a-2b7f144aeb9b	MagmaFlow	rejected
Stage 1	02e01a93-b0cf-41fb-9327-8e8cc6a1fced	MagmaFlow	rejected
Stage 1	0792557b-0d08-4d37-b18e-624debc49e6f	Mama Putt	rejected
Stage 1	4ce99667-0408-4f4f-a101-8308ac5346c8	Mancer	rejected
Stage 1	543a376c-d8b5-47af-bbb3-481f514364f1	MARÉ PROTOCOL	rejected
Stage 1	f247d710-4524-4092-89b9-677163496b10	Maritime Intelligence Hub	rejected
Stage 1	44d529fa-836a-4b10-9a10-114e382842b7	Mashmellow	rejected
Stage 1	b1e0cff1-585a-482c-8e11-eda944a112cc	MASIA	rejected
Stage 1	660fb72b-207c-4e35-8caf-5cb64dade9b7	MatchMesh: On‑Chain Tournament Engine for Avalanche	rejected
Stage 1	d35d03c3-38d1-4f38-89b1-e72ce84846b3	Matrix Chain	rejected
Stage 1	73ea60c9-6e58-41db-acec-855d54f0ed65	MaybeSwap	rejected
Stage 1	7796b2cd-9b95-48e6-a53d-f3d0ed1ada8b	MediChain	rejected
Stage 1	f95a4c52-3367-43a8-a71b-f6b79d187659	MediGuide	rejected
Stage 1	5035dcd1-ab1d-4df8-8c75-9a3ac9b24c50	Megamint	rejected
Stage 1	c1075d8b-da30-41f4-8df4-d33bb110525f	Menra AI	no S1 verdict
Stage 1	ad346f2d-b1ae-4f70-8de0-65e0a6211336	Mintvue	rejected
Stage 1	d55a48bf-7c3a-4276-8fc8-2195447ba409	Mirra	rejected
Stage 1	7e6363bb-8a27-4ec2-a80f-11177eabac52	Mirror Soul	rejected
Stage 1	72d2924c-0c6e-45eb-b378-ae6875c6125a	Moebius	rejected
Stage 1	103cf3ae-5d59-494b-aacb-53b1440d4078	Mogate	rejected
Stage 1	61de81b8-bbf4-4c13-9b79-9270c7db95ca	MoltDuel	rejected
Stage 1	8cfa7e04-972f-436c-9505-4f80b8e9cab2	Mooadon	rejected
Stage 1	2851c5cb-5726-4fe9-a7c7-af80f70c16ee	Moolaah Finance	rejected
Stage 1	11eb66ae-3b28-4c19-b33f-fed6ff97e61c	Music on Chain	rejected
Stage 1	3ebd616d-e5e8-4a9a-899f-69d16498f876	Narco	rejected
Stage 1	c6548d9a-1d23-4980-9b88-881922ca786f	NARIK PAY	rejected
Stage 1	5e031fde-e2cf-4d39-b3a0-0668fb340b3e	Neon Sentinel	rejected
Stage 1	9aa853a3-a747-47b6-b020-8d158598224d	NEURA	rejected
Stage 1	0aae74bb-d713-4db8-9efb-118cdaebf620	NeuralSky	rejected
Stage 1	0279cab0-b956-48d1-8af1-becd8be19bcd	NexIntent	rejected
Stage 1	1eed9e1a-e9d1-4e7b-a706-f48767aaa065	NEXUS	rejected
Stage 1	8fab5159-b9e5-4a24-9416-2a6e4891a9a1	NEXUS	rejected
Stage 1	d54a2c0c-651b-4aab-8c5f-56e700a9104e	Nexus	rejected
Stage 1	01e956ce-a053-4c0e-a4d7-83753b4c9395	Nexus Frontier	rejected
Stage 1	91db717d-f0ee-449e-acee-f41fa488c444	Nexus Protocol	rejected
Stage 1	36d84133-08aa-4334-94c8-367bc5aa782d	NEXUS: alpha	rejected
Stage 1	b4708e5b-95f1-4bce-ace3-4a47d78bd566	NightTales	rejected
Stage 1	4f5a348e-5480-4e8c-92fe-6d08034356a8	Ninja Catalyst Game	rejected
Stage 1	9b85f704-06bb-4586-bc64-f3478503b049	NoaSight	rejected
Stage 1	a6335a73-a8bc-4fd1-8757-d07fa245a2bd	Node Speak	rejected
Stage 1	33019897-cb9d-4bca-a148-789e97f6b815	NodeCity	rejected
Stage 1	9b39a044-27e3-41ba-9438-6c0855e57905	Nodeweb AI	rejected
Stage 1	61c9aae1-f26e-4ef9-97bb-86b79d0e5350	Noise World	rejected
Stage 1	90a4bd3f-cfe1-4215-82b5-e290b617eaa5	NOVA	rejected
Stage 1	b47efe93-1697-444e-964d-558e66a3bc75	NUVO: Adaptive Stablecoin Settlement Layer	rejected
Stage 1	ffa2fd53-8acd-453a-b655-76215ea6cf4e	obscura bridge	rejected
Stage 1	6917388e-42de-494c-b94c-16eacb057ba6	Olympus	rejected
Stage 1	52243b5b-dfa3-4adb-b551-4da2925d2088	Omarapay — Where Commerce Becomes Infrastructure.	rejected
Stage 1	5ec0e23d-157e-4212-ad6a-70cd56e09169	Omega OS	rejected
Stage 1	8ae3efaa-27a4-494a-aab3-c00ac36076eb	Oncue	rejected
Stage 1	1795a912-a6dd-4dd4-9792-20158a18ca6f	Opencap	rejected
Stage 1	485342a9-aa4c-4de4-a0f5-2c25cb9c2e92	openpick-edu platform	rejected
Stage 1	42898a6e-5ae0-46a0-8438-25e62cdb1173	OPTUS	rejected
Stage 1	eb32694a-2b8d-4dde-a3f7-4295c615b4a1	Orinx	rejected
Stage 1	54a4906d-e4d5-42de-990d-4e25f2f7c1d1	Oryn Finance	rejected
Stage 1	7b17a1ae-1f03-4ae8-ab07-0f36db181f78	Outer World	rejected
Stage 1	cbfd6f12-f40c-44ab-ac03-2e83252704ee	Outrun	rejected
Stage 1	b54e0477-c881-43e3-8b41-ba962d1fab5e	Packs	no S1 verdict
Stage 1	dae7eb2f-ee18-42f6-9e08-9d9ba4cd920a	Palladium	no S1 verdict
Stage 1	4f747473-80ce-48a0-8006-3af70795aebe	PAPAGEDON	rejected
Stage 1	b4ed1f93-dfd9-4d06-9f6c-9c7baa03c9d8	Pasalanche	rejected
Stage 1	a9d0b61f-b49b-4034-8329-d359e9d66952	PASSAVAX	rejected
Stage 1	6d633d71-0d4a-4a67-9276-0d1b7e777878	PayEase	no S1 verdict
Stage 1	9837e2a4-ce3b-4b5e-b7a1-2d5cf06b2b77	Paymind	rejected
Stage 1	07272f5f-9c15-4294-8a3e-e706e92e54b8	PayNest	rejected
Stage 1	04c69c1a-b167-437c-b272-27ac87784f25	Peak	rejected
Stage 1	e22d382c-3b07-40d2-bc7f-bc418907e19c	PeakBalance	rejected
Stage 1	789da47e-9b22-47a5-9f16-88287c4bf9aa	Peerclaw	rejected
Stage 1	70d57468-a66b-4845-ad42-0315603f254f	PerkOS Swarm	rejected
Stage 1	5973a3cc-67b1-404c-9aa3-027df49f2afb	Phone and Dream	rejected
Stage 1	47c68279-f2eb-4e66-8d63-78eebe69abe0	Pinnacall	rejected
Stage 1	06796b26-cb3c-47ac-9aba-fc583a5d5a02	PixelAvalanche	rejected
Stage 1	d2cd8206-bb3e-4ba8-af69-f106e2d5fb4b	PixelDash Stakes, stylized as "PixelDash $takes"	rejected
Stage 1	a382c7d5-3ce3-4b98-a716-68e40c40182e	PixelFrost	rejected
Stage 1	a4111095-02e2-4c1f-aac0-fa69b8a0801e	PixelGlacier	rejected
Stage 1	99197138-5f36-4b39-a390-427a17ed032e	PixelRaid	rejected
Stage 1	dfcd8aa3-b98f-4a35-9837-2f89de9d9a48	Plague Hunt	rejected
Stage 1	c39fe789-f87d-4cbd-820c-f7260319a2ce	Planet Hares	rejected
Stage 1	c7266f6d-67b5-4742-996b-2a8ac9db1b04	Planetary	rejected
Stage 1	3445405e-3216-4656-9ec9-c0ede1c8dbbb	playproof	rejected
Stage 1	101af025-cf65-4898-89a9-7fe1617133de	PlayXI	rejected
Stage 1	91e72943-a07f-4036-8cce-c44ee221acde	Prediction Arena	rejected
Stage 1	823d0930-bcce-47a2-8c00-92597f3dd349	Prediction Arena	rejected
Stage 1	7a790564-0b3b-49a5-ad53-3ee0f87f0797	PrefLedger	rejected
Stage 1	e3f21c0b-b133-4e30-894a-2fba776c55f6	Prism	rejected
Stage 1	f4ec4e85-2404-45c0-af3a-d902900e640d	private.fun	rejected
Stage 1	8ed5163b-f0a2-40e0-95e7-f2ec591736d0	Profort	rejected
Stage 1	72b39aed-266f-41fd-b178-53c667a973e1	Project Inspire	rejected
Stage 1	f4212b9a-f9f7-4422-a8c7-a6698a160c94	PROJECT SUBNET STORM	rejected
Stage 1	08ff2c4a-dbb4-4c36-aa29-c6be67bd9857	PROJECT SUBNET STORM	rejected
Stage 1	d9d8e4a8-17ec-4770-8a18-0f84b02c8bff	Project Xioni	rejected
Stage 1	9206814b-b8bc-4171-8669-6b6c81175ba6	Proof of 21	rejected
Stage 1	bb44c1b6-72b6-43a6-8123-46a3a6140795	Proof of Contribution Protocol	rejected
Stage 1	5c3edccc-1a37-4d9f-9f9b-c29b680bff39	Proof of Effort	rejected
Stage 1	76714f8b-8762-4266-9f57-55ce0171a392	Proof of Exploration	rejected
Stage 1	bb245707-57ba-4d87-aa35-d9726ccd228f	Proof of Skill Arena	rejected
Stage 1	369921f2-043b-4c3d-a29d-551e7262a28f	Proof of Trust	rejected
Stage 1	57eb51f8-6d9f-48f7-b0c2-a9297ea71460	ProofMarket	rejected
Stage 1	afdf402d-fdb7-4bec-b2ff-2245dcaa3691	proSEED Global	rejected
Stage 1	a38af2ef-60b6-4418-98ec-bd314d9983a9	Provalanche	rejected
Stage 1	20631bbb-1385-4cf1-8dd0-92c5c83ba728	PRYMUS	rejected
Stage 1	717d60a8-8ea1-4ec3-88d4-13d2e013c085	PulseAid	rejected
Stage 1	fcc8a73d-ad9f-41ad-b43b-1432190d5a81	Pverse (flowPAY)	rejected
Stage 1	b7749230-25fa-4a6d-8130-50dfbacac92c	Qimera	rejected
Stage 1	6b7b3e28-9108-4ed4-a681-a3e28b4f9d92	QromGuard	rejected
Stage 1	18fe42f6-9478-43a0-965d-99dadcf36065	QUDO	rejected
Stage 1	ab6c96e4-3ca6-4922-a9bf-13069746485e	QUEST CHAIN	rejected
Stage 1	bfd47878-5b9c-425b-aeb4-83db463d37fb	RaceX Manager	rejected
Stage 1	c2090bde-522e-4a71-9d59-afcf08f2ac1a	RaceX Manager	rejected
Stage 1	ade77b17-efb5-4792-96ac-6986650d4776	Rail	rejected
Stage 1	d29a4ce0-c36f-42e9-b6a2-30ce9d31561b	Rampwool	rejected
Stage 1	d013dfe9-9a91-4dae-9ead-ef3431e48af0	Read Me	rejected
Stage 1	071c569d-953b-467e-82a7-8357802fdb6a	REALIZ-3	rejected
Stage 1	60f4db1c-8811-486e-97b9-9354022d0286	Recy Network Payment System	rejected
Stage 1	0e1e9b8e-ad10-47fa-abbb-9d730f948ef1	Redline Orbit	rejected
Stage 1	80f9a3fe-da6d-4279-8ec5-74c62dd05a69	Reflex Arena	rejected
Stage 1	d02ad6d3-9163-44fd-87bd-add01b458f31	Reflow Technologies	rejected
Stage 1	d4603478-13c0-4569-a0f2-c8c290894eff	Relay	rejected
Stage 1	834b106e-6b60-41db-9096-b7f80ad82d42	Relotto	rejected
Stage 1	039032ee-625a-41c7-8486-ef75bd41be05	ResolveX	rejected
Stage 1	bd61384f-a0c7-47bb-b725-1fcf453e4384	RetroPick	rejected
Stage 1	263b715f-5736-4aed-a074-6d2332fea9c0	RetroPick	rejected
Stage 1	041f012f-57d5-48cb-87dc-8b5b1eb9d5c2	Rhesoma Online	rejected
Stage 1	eaf723f4-f89b-4652-bf3a-ea0f92b07026	Ringside Protocol	rejected
Stage 1	57ea7638-d9b8-4847-8d84-7c4e168231b6	Risk-Weighted Cross-Chain Flow Optimizer	rejected
Stage 1	114256b0-bd33-43cd-aa14-678d610b873e	Rivals.avax	rejected
Stage 1	5a28878f-488b-46b8-b5d3-361f54f072b7	Robotics hand	rejected
Stage 1	f036ca73-27f1-46dc-8779-70c2004cc3b5	Roulette	rejected
Stage 1	b883bf0a-ec1c-427f-a69b-253f977373bb	Roulette	rejected
Stage 1	ebb9b9aa-890f-48ef-ba63-92c5924de666	Roulette	rejected
Stage 1	8bbc17b0-fa4e-4a79-9baf-da308414cfd4	RPGHero	rejected
Stage 1	564dae85-f2fc-496f-b2bb-364773e79863	RunRate	rejected
Stage 1	fa805cb1-94d5-466d-97a1-c41f4c811321	Rush Gamig	rejected
Stage 1	ff0c75e4-6a36-4a62-bb54-41a5c3d0d6d4	Rush Gaming	rejected
Stage 1	0241b84f-b7b8-4798-9cc0-cbb8fe47ec75	RWA Wine Anti-Counterfeiting	rejected
Stage 1	7e2b22c6-a9be-490a-8c09-41101bb068a9	rwaInsight	rejected
Stage 1	934dd064-1beb-496d-9c9c-26b97c030337	SadaWallet	rejected
Stage 1	a0848da5-59cb-4cec-bf2e-effc652516cf	SafeMPC Wallet	rejected
Stage 1	e1196923-b1c8-4991-bf24-4c734e6f85ac	SafeSkul	rejected
Stage 1	e125b0c0-80d9-4784-a22a-df89c8df07a5	Salt Agent Marketplace	rejected
Stage 1	572aef56-203a-4f12-bbfe-268b9008403c	Scurvy Bot	rejected
Stage 1	60c54eae-11cc-4403-bec4-de7aae47c9e3	SecondWeb Game	rejected
Stage 1	421fba28-111b-40d1-9cd3-65e5be49276e	Sendly	rejected
Stage 1	a2757f6b-8c3e-4628-8e5b-6f1533966475	SeTi	rejected
Stage 1	396c06d6-d1c9-4265-9a97-27c605d4ffb4	SeTi	rejected
Stage 1	f3d40e14-9317-40ca-b535-453e0367a593	SeTi Labs	rejected
Stage 1	8788ed7a-334c-4c4a-acc8-831a90e0a688	SettleX	rejected
Stage 1	1a4bf36a-c774-4dc5-8e66-edb266abb470	Shadow Command: The Global Front	rejected
Stage 1	ca050a28-0eba-4d25-b7c2-b7410ebbc794	Shadow Pay	rejected
Stage 1	608ab2cd-d8d0-4c64-9c43-0921f5867943	ShardFall	rejected
Stage 1	2465b8d9-204c-4971-8b5a-b46481b02ed9	Shardfall: Echoes of Avalanche	rejected
Stage 1	33e3c8bc-7e8f-489d-bb7b-dd06a357a02a	Shelterflex	rejected
Stage 1	373a0b68-08f1-4c42-b764-f6e673ce207e	Shin	rejected
Stage 1	cb2165f7-dcd1-4b43-8ebf-39419212a244	ShunyaCode	rejected
Stage 1	f6fcb866-7614-4b76-89a1-b8cb83e18049	SideQuest	rejected
Stage 1	d7a64451-516b-44a1-9f9c-e90e664d82aa	Sincerin	rejected
Stage 1	143d02a1-d07d-46df-8540-f8959a68f811	Skillbird.	rejected
Stage 1	663611c3-ea02-4e39-9167-1f96653c1911	SkillForge AI	rejected
Stage 1	dad8ed49-0e74-44fb-badc-e6957d48bf86	SkillShot Arena	rejected
Stage 1	39d2099e-a01d-4ad6-b5f3-4800c04097bf	SKYDN	no S1 verdict
Stage 1	9482afae-f17f-40a2-86da-3abba6e6e2b4	Skyrax	rejected
Stage 1	859299eb-7033-4ed2-969b-1e07d7538e5d	Slimepay	rejected
Stage 1	da258871-b5ab-4918-b8b1-ce0e674c1942	SmoothSend	rejected
Stage 1	f7a90585-d109-402d-a9ca-af6e9580b01a	Snow Labz	rejected
Stage 1	ec296f7a-e256-4b0d-b382-6556adfb9f26	Snowballers	rejected
Stage 1	8a25e360-3d11-44fa-a2e4-a84861c34097	SnowByte	rejected
Stage 1	2bc03036-2f29-47d7-bf50-579e3b19457d	SnowCall	rejected
Stage 1	ad13ab13-14ff-4b00-8730-fc456ab16b74	SnowCrafted	rejected
Stage 1	2caa29d9-3df5-4604-8422-9208a2b4a266	SnowDashers	rejected
Stage 1	0e3a39dd-d978-4a98-b3ab-8689ce09d9e4	SnowHeroes	rejected
Stage 1	729fb7fc-8a2a-4d7b-a599-0d60867f8d4f	SnowSaga	rejected
Stage 1	e82f70af-5aff-462a-9f35-345c56173cfc	Soldier Ant Colony	rejected
Stage 1	74947544-05b6-4f3a-9fc3-10cf1ba78ecb	SoulMatch	rejected
Stage 1	bdc8d357-9a4a-48e2-9b6d-7c6dadcb0715	Space Bases	rejected
Stage 1	b85a2ec4-cfa8-481a-a9c9-c5a8465d7617	SpaghettiNet	rejected
Stage 1	954d0472-11b9-4a0a-a442-d0bbaad8e579	SpooVault	rejected
Stage 1	41125948-ad09-4940-b43a-da521465b52b	SquatFi	rejected
Stage 1	ee1c764a-7725-42ba-932f-c42a9f9c69c2	SquAvax	rejected
Stage 1	3d159439-ffba-4e9e-a8b3-2aa627dd8767	StablePlay	rejected
Stage 1	2f8dde96-7a30-45df-b845-1eb738fe7fad	Starrent	no S1 verdict
Stage 1	e6ac5b0e-112d-4365-8ef5-ad71f3c62349	starstrikesquadron	rejected
Stage 1	6561edc7-2271-404a-9cbb-1b4c31bae092	StealthPay	rejected
Stage 1	0c54705f-03b0-4a5b-9f8b-bf498061a107	StellarHub	rejected
Stage 1	46e4bf1b-38c1-4239-a3b2-52851c36ab20	Stratos Markets	rejected
Stage 1	894baa80-825f-4e85-9949-49d1ecc46bd5	StreakDAO	rejected
Stage 1	8b5d6920-ca30-4569-bf6c-f4c7047de7cf	Stupid Monkeys Realm Hero	rejected
Stage 1	41ea4965-66c2-43f8-915e-b5cebe0fe026	SubnetKit	rejected
Stage 1	3557f1bf-8775-4787-830c-a5faf35c5867	SubnetOps	rejected
Stage 1	c32200f2-4679-405a-a675-f533451ae71e	Suede Labs	rejected
Stage 1	edee34af-dd13-4753-afed-46d01b938a89	SuperStack	rejected
Stage 1	0e92ba49-881c-47b6-bf42-ea4646c6029b	SweepStake	rejected
Stage 1	df676837-b147-4f16-b300-c0bc12f70e3a	Synthetics	rejected
Stage 1	d63b5624-c3d0-4cdc-8341-b590981b730c	SYNTR	rejected
Stage 1	dbd6ed27-2671-42d2-a10d-d990f11d4134	Tamago	rejected
Stage 1	629d63b9-cde8-4e90-a5c8-82ca946dc29a	Tapoption	rejected
Stage 1	d2d57e3f-5e1c-4bbf-bed9-ce22d2e8985f	Tawf - Mandated Capital Subnet (MCS)	rejected
Stage 1	41a590e4-2213-49cc-88b5-79429a3ea9cf	Teritage	rejected
Stage 1	0e12e5a3-c5e2-460b-a1ab-e456029024cb	Terrachains	rejected
Stage 1	7fdd4da4-4703-4a66-9195-f94e5a636866	The Avax Aviate	rejected
Stage 1	0e1b06dd-cef3-4aa8-b399-6ceb96a5267f	THE BATTLEGROUND	rejected
Stage 1	d7b3389a-f5a7-45ac-9f35-13f0bce88189	The Casino and the Church	no S1 verdict
Stage 1	2553ed2c-d875-4f06-a5a3-a8df983aa842	The Curator' Nest	rejected
Stage 1	3b6810ac-4041-4932-b9de-9f7b0800b2fe	The Last Clue	rejected
Stage 1	8c87004a-bc06-4174-82cc-b11ef6e4e94a	Think to Win	rejected
Stage 1	8d02f0df-7911-4a44-b421-6d6a13f73cc2	Tiny Army	rejected
Stage 1	5b54f658-b421-4989-a5d2-db7a9125fcbe	Token Tails	rejected
Stage 1	2618a61b-c1e9-4960-b0af-93728d36c12a	TokenBrawl	rejected
Stage 1	87487f32-c7ef-4e86-b8e1-b45d57c33c7e	TokenDash	rejected
Stage 1	8af442cb-3d42-4fdd-bd93-f5cb01ae38a8	TokenRumble	rejected
Stage 1	23b94247-d2aa-491a-ad54-3f458a77fc2c	TokenTales	rejected
Stage 1	c74a90fa-ebb0-4468-b3fb-7bb4a721fb23	TokenTemple	rejected
Stage 1	0e31ac70-d15c-46dc-ae79-b9fc399ca26e	TokenTrek	rejected
Stage 1	c689c71f-950d-4863-a136-9283707f658e	TokenTrials	rejected
Stage 1	6850e9a6-3e31-4c60-a762-2204b43ca7a1	Toon Central Hub	rejected
Stage 1	f54423e5-9cf8-4943-bce7-7591c92a60f6	Top Secret Game	rejected
Stage 1	6866da35-a8ad-44d3-b47c-d7750a067893	Tozlow	rejected
Stage 1	f11d3c4b-b76f-4c93-9ef1-409f26ab5a0b	TradeWars	rejected
Stage 1	e0e104e7-c7f3-4348-9eae-1ab3fc5c80d0	Tranct	rejected
Stage 1	77a9c182-ad7b-4973-a4d7-e5493df90dcc	Transparency Protocol	rejected
Stage 1	2de4b622-1f4c-4ce9-878d-2f8c4e5f08b8	Trapchain	rejected
Stage 1	404fbdf2-d5d6-4e77-884f-69ff4ffefb96	Trapped or Not	rejected
Stage 1	34ba930d-a6bd-4fec-b71e-3a8876971446	TRAXR-AVAX: Pool & Contract Risk Intelligence (Alpha)	rejected
Stage 1	d0c37539-971d-467f-93a5-dd46b77a35a5	TRINITY	rejected
Stage 1	0e10c2cc-186b-4164-93f2-779296f4ed94	Tychee	rejected
Stage 1	ddfe913b-6dd7-4724-b633-5b3c0591f3ec	UltraRentz	rejected
Stage 1	1dd4f233-6b91-40a1-883c-c3e326213408	Unearthed	rejected
Stage 1	fad5183c-965a-431a-bf71-e83ad57d1e5e	Unearthed	rejected
Stage 1	8ed5ebf7-2d63-41dd-bb19-e3e7611cd961	UniRWA	rejected
Stage 1	15468d53-a91d-49a0-b453-6102e0dd5b04	Unity Wallet	rejected
Stage 1	52169283-e80a-4720-a610-f78c1d33fdba	Universal Inventory Protocol	rejected
Stage 1	31d65943-5e0d-4271-982c-ce5e2f30d621	UpArena	rejected
Stage 1	9e91fb07-538f-4c05-a953-455866df38b1	Utopiany in accepted by nature of Love Legacy	rejected
Stage 1	16e15f96-2e46-49be-9241-b798fa29d99a	Valcore	rejected
Stage 1	9c645919-077c-49ed-b29a-d02f6ca69adf	Vanguard Vault	rejected
Stage 1	a08358bb-3bf3-4769-b0dc-d0fa19dd8922	Vault	rejected
Stage 1	216cf165-3545-4315-bc27-01683026cf7e	Vaultfire	rejected
Stage 1	c1a2172b-0862-43fb-acf1-8f837dbab5c2	VecindApp	rejected
Stage 1	b0f55502-6b32-465f-ba54-bcb58217d05b	Veil	no S1 verdict
Stage 1	53273099-e172-4840-9d16-86f585064208	VEIL	rejected
Stage 1	8854ebdd-c00a-430f-a0c3-8d6a877711b5	Vera	no S1 verdict
Stage 1	f66763cd-fa8e-40f2-abeb-6664356dbaef	Verdant	rejected
Stage 1	3ef07a5e-d4bc-4257-880f-3e46bf109351	Veridex Protocol	rejected
Stage 1	0b996b83-06e3-4325-8019-b3d2a93b627e	Veridian	rejected
Stage 1	a652989c-69c4-4307-936b-41eef5e32824	Verifik x402 — The Trust Layer for AI Agents	rejected
Stage 1	96e253f9-f853-48b4-8528-f21faeb3ed07	VeriFolio	rejected
Stage 1	a2253dfa-f037-4eab-b110-68e6e2a2efee	VeriFolio	rejected
Stage 1	32930190-3aa6-46e5-b771-090e5cc5c60b	Vibe2Wizard	rejected
Stage 1	0796c9a5-adf1-41ac-a43a-9915eea0fb09	Vintage Avalanche	rejected
Stage 1	1046ed2a-5e28-4fab-b5a2-599c13f3852e	VIRUS PIT	rejected
Stage 1	0710f7c3-55dd-4a4d-b873-4dcb2d8cc976	vizinhaça cuidadora	rejected
Stage 1	7f146960-7292-49ba-bcd5-fbbf476b8c74	VODOU - Hunting Grounds	rejected
Stage 1	dedbfa7c-56ec-4a47-9be1-205aab59e3a3	Vouch Protocol	rejected
Stage 1	83c8ef2a-4516-4a97-9359-e0755ff8eb2e	VOURNEAUX ESCAPISM	rejected
Stage 1	446df56a-29f0-4c49-bfa1-af8bbd7500ed	WARD	rejected
Stage 1	52db0e38-f37f-4f8f-be27-39ca3e176ccd	Web3 ORM	rejected
Stage 1	4af262d1-f704-4f15-b935-afaf0b216f93	Web3 ORM	rejected
Stage 1	69d472e2-6dd0-4370-84ac-20287157e689	Whadar	rejected
Stage 1	7d3b4b7c-4f7c-4c36-a83a-905986fdfacd	Whitepaper IQ	no S1 verdict
Stage 1	cad98db7-6ef8-4652-9a4a-cba414588f48	win.fun	no S1 verdict
Stage 1	efde810e-4260-42de-b02d-16b33cf975bc	Wind cash avax	rejected
Stage 1	7caee74c-a3d1-410c-bc71-2434e4d2cc56	Wizverse	rejected
Stage 1	55dad44d-ad63-4a2b-89b7-3de1a0941b3c	Wizverse	rejected
Stage 1	9bb5dcbd-3d40-4090-ac39-5a196486ee82	Wordlanche	rejected
Stage 1	d80b0e88-ae02-4407-9f6d-96043f566eca	WorkforWork	rejected
Stage 1	4d2203aa-030c-4640-82fe-e03e2a92e586	World Of Fight	rejected
Stage 1	32a0caff-5460-40f9-8032-e4c2d6760dc5	XC Capital	rejected
Stage 1	f76ba334-a5bd-47ce-9e70-d42b9f7aa4d8	xenon Rise	rejected
Stage 1	c4012b2b-9b24-48d7-898c-de9b65de25a8	Xero Oracles	rejected
Stage 1	ddddcbde-0319-43c0-87cf-fc88107a6664	Xero Oracles	rejected
Stage 1	31ad3c24-c29a-4d9f-9cf0-a54b7d3b3ea5	Xylks!	rejected
Stage 1	6a672b99-7893-49e2-a15d-d9cdcd2c7346	YieldPlay	rejected
Stage 1	1ac58597-5b60-46ee-8f67-73d8e20851cb	zodiaglow	rejected
Stage 1	eca69fd2-f207-44d4-a4d5-34abc7b711b9	ZSPACE, the 4D Web App	rejected
Stage 1	7eca9264-3cea-4ec2-a07b-d581ef074e23		no S1 verdict
Stage 1	83ce32c9-5d65-498d-bafc-d45c46234349		rejected
Stage 1	b3a5d788-65c1-4f1c-bf83-571f9a2e5e45		no S1 verdict
Stage 1	db992027-e115-4488-b035-e28bcf5aa92d		no S1 verdict
Stage 1	3f5cb0ca-50ad-429c-bd6e-74fb4e8abeda		no S1 verdict
Stage 1	7cdd4619-d747-45f9-8de7-d2d0d6ba0746		no S1 verdict
Stage 1	7be017a8-3be8-4b97-b382-a4074650fc30		no S1 verdict
Stage 1	e0c9fcc9-a64e-441d-a6ae-3a3909693a7c		rejected
Stage 1	0167f62e-e3f3-4bb5-a2cd-b2c5b43e2b6b		rejected
Stage 1	92231023-ed63-4c48-ac24-3f1115eac513		no S1 verdict
Stage 1	8d268423-8732-455e-97d8-d4fcc023d23a		no S1 verdict
Stage 1	70c3d828-f080-4566-b908-dc63726d1e1b		no S1 verdict
Stage 1	68d91d95-7333-4d5d-962a-322f1f30a029		no S1 verdict
Stage 1	d43cbe3a-27e2-425f-a96e-b58f377877bb		no S1 verdict
Stage 1	0f34a712-b8a7-452d-8467-9a042dc6cd3a		no S1 verdict
Stage 1	50b44885-fab7-43b7-9172-dd33036c9d1f		no S1 verdict
Stage 1	3a1e6c85-5ae8-4da0-9c48-9ea810bf95c3		no S1 verdict
Stage 1	048c8f58-cbe5-46e1-a32f-55d6d5f459fd		no S1 verdict
Stage 1	6f5026ec-9960-46db-8bd6-233405364741		no S1 verdict
Stage 1	41c7a103-ef36-4cd6-b2ff-0947c4e61881		no S1 verdict
Stage 1	a537e860-f980-4052-87e3-f2efe85d4a00		no S1 verdict
Stage 1	206ca095-1818-4220-8ae8-c2c570f90e01		no S1 verdict
Stage 1	11dbdec1-104d-4c9d-93c8-0aba23667ebb		no S1 verdict
Stage 1	4308a416-58ad-40dc-8d2d-e5033164ce3c		no S1 verdict
Stage 1	b4a44868-88eb-4475-ae54-167614cae382		no S1 verdict
Stage 1	f7f04434-b22c-46f9-b7d9-47ab42b2d072		no S1 verdict
Stage 1	aa1093bf-ded6-4740-9b9b-28d383b34e04		no S1 verdict
Stage 1	649e8934-2d6a-4275-b472-4e1dd200c426		no S1 verdict
Stage 1	afb2632e-412e-4dd1-81c1-e5dcc3bf9a9a		no S1 verdict
Stage 1	8eff2fcd-9938-4d53-a7a5-ba7874d444cd		no S1 verdict
Stage 1	d506e49a-2114-4bac-9533-79ea16e148a4		no S1 verdict
Stage 1	a45c6f0e-0f63-4ce4-9912-856ab55e63fd		no S1 verdict
Stage 1	43d279ad-5ca1-47f6-9f07-f5a0eee09249		no S1 verdict
Stage 1	128162a2-067f-459c-9375-7c676d647425		no S1 verdict
Stage 1	a244b3fd-6492-44c1-9b35-407d3ba3f38e		no S1 verdict
Stage 1	0dd09afb-e1a6-4b85-aa23-cce587ebfbda		no S1 verdict
Stage 1	c1804af9-4b27-4e66-b93c-b2b1702bd01e		no S1 verdict
`;

function parseRows(rawRows: string): BuildGamesStageSeedRow[] {
  return rawRows
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [bucket, projectId, projectName, memberConfirmation] = line.split('\t');
      const mapping = BUCKET_TO_STAGE[bucket];
      if (!mapping) {
        throw new Error(`Unknown bucket "${bucket}" for project ${projectId}`);
      }
      return {
        bucket,
        projectId,
        projectName,
        memberConfirmation,
        stage: mapping.stage,
        stageClassification: mapping.classification,
      };
    });
}

export const BUILD_GAMES_2026_STAGE_ROWS = parseRows(RAW_BUILD_GAMES_2026_STAGE_ROWS);
