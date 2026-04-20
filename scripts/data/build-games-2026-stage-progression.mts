export type BuildGamesStageSeedRow = {
  bucket: string;
  projectId: string;
  projectName: string;
  memberConfirmation: string;
  stage: 3 | 4;
  stageClassification: 'stage_3_only' | 'stage_4_finalist';
};

const RAW_BUILD_GAMES_2026_STAGE_ROWS = String.raw`
Finalist	5cd3c05b-9ff9-4a6d-bc48-8c20fdea93b0	Tenor Protocol	Finalist
Finalist	924f14e6-e208-48db-b5ac-6e7a37cdeb18	Ammo Markets	Finalist
Finalist	4cfbdbd3-4ef9-4dfb-ad14-ed22f6103268	Katchi	Finalist
Finalist	d4721880-29d6-440d-aa68-2db5152872f0	Abitus	Finalist
Finalist	d8c6e7ae-c688-42e8-9f69-4acdedbf394e	Dhahaby	Finalist
Finalist	edce2986-8758-442d-917e-00e4f1eb6492	Poll It	Finalist
Finalist	fa670214-81bf-4eef-ad9b-cc984d73cf6d	WeBlock	Finalist
Finalist	57b8cafb-2e7f-4272-83f3-05ef761e91d8	Avantage	Finalist
Finalist	f74eb671-8241-4ab1-88d6-7e4165f51e8f	AMP Avalanche Matchmaking Protocol	Finalist
Finalist	de2cb83a-8ca4-4f83-8266-2373ea5fea6c	The Grotto L1	Finalist
Finalist	2d76cf52-2311-4a40-a916-b9d7d0c88ecd	PAYPS: From Web2 to Web3	Finalist
Finalist	03f9bf07-f6bb-4dd5-9f0d-aba7b0f0dfd9	Meridian	Finalist
Finalist	18ac267e-44a3-453d-ba8b-7dc92f5265aa	We Keep Winning	Finalist
Finalist	7e43bfec-c7f4-4eda-b7c3-6278926281f8	Your Grails	Finalist
Finalist	51c4ffe8-81be-49ab-9820-4b879c82604e	Senku	Finalist
Finalist	e7fda485-2729-49eb-bb3a-da93c2c3746f	PartyHat	Finalist
Finalist	2b754151-0969-429f-97de-8642a2f8fdb6	FanCrypto	Finalist
Finalist	ebc06634-36e5-4997-94e4-c9648736c626	Forg3t Protocol	Finalist
Finalist	38860010-b46a-40e7-a0b2-63b9fdb57d9a	SOVA	Finalist
Finalist	746b1cb1-f477-436b-affb-6368d37112e0	Predict by Kokomo Games	Finalist
Finalist	c8ea9cdc-3f61-4942-9aa1-c35283691cbb	Peridot	Finalist
Finalist	09c59782-d3c8-47d7-85d5-a25cfb73997a	alma	Finalist
Finalist	a4455640-cc1b-4eef-ae12-149751fb818f	Knovel Protocol	Finalist
Prize no Finalist	83edaac7-655f-409c-a961-eb5867aa7e9c	Gladius	Prize , no Finalist
Prize no Finalist	98b5a16f-f43f-4a5e-9391-a5884817f422	Lil Burn	Prize , no Finalist
Prize no Finalist	aadfaec0-d608-4b8d-912d-3eda4a50b775	SliqPay Africa	Prize , no Finalist
Prize no Finalist	70d9f612-b12e-41b2-a975-110d60b1cc04	Wolfi Rumble	Prize , no Finalist
Prize no Finalist	eb786a44-3f59-4dc2-81ec-023e151a24fc	AvaPay	Prize , no Finalist
Prize no Finalist	ae864b9f-7727-40c7-ac2c-0c9899394f9e	OmeSwap	Prize , no Finalist
Prize no Finalist	7e976679-6033-422d-a10e-2d34ea0a4387	Falaj	Prize , no Finalist
Prize no Finalist	ede27121-8475-42c3-8995-b00ee1af8cc6	Loopia	Prize , no Finalist
Prize no Finalist	daca4fa7-a44b-4741-97c5-8a1fc259da39	Autonomous Treasury Guardian	Prize , no Finalist
Prize no Finalist	3e7c7f7a-e622-4b20-aa5a-10ea2684dba1	QuantumsFate	Prize , no Finalist
Prize no Finalist	60147f38-6e29-4d0f-94a3-4556db7f0fb8	Tippikl	Prize , no Finalist
Prize no Finalist	105d46a8-a25f-40dc-8ee6-77deb52f8f47	Shroud Network	Prize , no Finalist
Prize no Finalist	6c8a0a9e-057b-43bf-8333-b3bf105658f1	8004Agent.Network	Prize , no Finalist
Prize no Finalist	f9913179-1682-4ce5-b6e3-830be576066e	OneClick Wallet	Prize , no Finalist
Prize no Finalist	7b4327bd-f9d7-428b-9ec6-44d273020faa	Vietnamese Fine Art Copyright Protection Ecosystem	Prize , no Finalist
Prize no Finalist	6f726ee5-5a9f-43b1-b4c1-f0d27319aebf	Trexx	Prize , no Finalist
Prize no Finalist	a0de9c81-72f1-44e3-9dd9-c37212e0f0a0	Warriors_AI-Rena	Prize , no Finalist
Prize no Finalist	b98bde5a-d4be-436d-917d-67136cd3051d	BitStat	Prize , no Finalist
Prize no Finalist	2ca3ee33-13b5-4cb4-9ea6-83a7d60bcc9f	Eavesdrop	Prize , no Finalist
Prize no Finalist	bd4bfe31-92fd-4f21-ab46-a512b42b9303	Basis Network	Prize , no Finalist
Prize no Finalist	e81656fc-4b93-4468-ad81-d262c6b9f81f	Gam3 Colony	Prize , no Finalist
Prize no Finalist	412cb893-f67e-4cd2-86b5-4103affd178f	Skullzee (by MadSkullz)	Prize , no Finalist
Prize no Finalist	6eb473bd-d512-44ec-9536-fc8640d27adc	Icicle Markets	Prize , no Finalist
Prize no Finalist	2daa62f2-562c-4153-82b6-dc3ac26cfc25	AVAX Bingo	Prize , no Finalist
Prize no Finalist	7f43e437-a6bc-4b8d-907d-056cbd7986e0	Lorescore	Prize , no Finalist
Prize no Finalist	9c2bcf59-19d4-4952-b1fd-9efa2c256c6f	GUNZscope	Prize , no Finalist
Prize no Finalist	c93ebe04-ab4e-45d9-bea8-1a54de3e4e59	ARI	Prize , no Finalist
Prize no Finalist	401532f3-c508-462f-8528-29ba0cc49cbd	guudscore	Prize , no Finalist
Prize no Finalist	3c8d1f7b-1e52-4b08-a5e1-ff289f4a136a	Capy Sword	Prize , no Finalist
Prize no Finalist	9d4123b0-75f2-47ab-ad45-b37c119289f8	Facinet	Prize , no Finalist
Prize no Finalist	c599cd94-bc57-4636-9f08-78b905ce4077	My Nochillio	Prize , no Finalist
Prize no Finalist	3f897730-51e1-4a31-8a95-7dd87bb436b4	ProTennis.fun	Prize , no Finalist
Prize no Finalist	1f9b8104-e525-4b49-ad03-a34cabeb2c55	Mimix	Prize , no Finalist
Prize no Finalist	a823f09e-b642-4c2f-b102-e0d53004989a	Renew.sh	Prize , no Finalist
No Prize	0a099493-c51a-4195-a736-1208431fbcdb	Conquest	No Prize
No Prize	2df0559e-c405-432f-a546-2d1d9d6436c6	AgentProof	No Prize
No Prize	50599767-19c5-406c-a4a7-30375945edf6	AuraReserve	No Prize
No Prize	500b0382-b9c7-4e32-8ee0-76e3c66768bf	RapiLoans	No Prize
No Prize	0073995d-f3c8-47be-9197-38f251e385c1	Collider V2	No Prize
No Prize	2f814596-67c7-46c4-b3a4-871019df6b3d	CARE Quest	No Prize
No Prize	9039c4d0-9330-4b2e-ae7b-2e89e72e6233	CAUSAL	No Prize
No Prize	68c23f96-7700-4647-b83e-c2802147453e	FiatRails Settlement	No Prize
No Prize	db19b98c-e5f6-47cb-a984-dfa1e2820d47	A2: The Saga of Alaz & Ayaz - A Tactical Duel of Fire & Ice	No Prize
No Prize	760a4768-0e2f-4f3a-96fb-5619b55faf88	Tallyview	No Prize
No Prize	8b076878-2552-4a10-b449-4e6797632892	Avanomad	No Prize
No Prize	28b8a901-b8a0-4599-bd7a-03e996fb5d17	Alpha Street	No Prize
No Prize	82dd801e-ba9b-4c09-bafa-19e4db1bb79f	Avalanche Blockchain based Secure Voting System	No Prize
No Prize	7b7721ba-935b-4388-b02e-de3b156fca40	BUFI	No Prize
No Prize	45825555-52f4-4d39-adda-28053adff3eb	Prize Bots Online	No Prize
No Prize	d6e0e194-3cab-4b48-a4f2-7e3934d89e62	Noah	No Prize
No Prize	7ec33d03-3178-47fc-be77-6f9da35c7603	MeltFi	No Prize
No Prize	0c867d08-ee0a-4648-b909-479652faf0e0	Mosaic	No Prize
No Prize	4aa8b19a-43e6-45ee-ba27-57f25cb40373	ZeroX Protocol	No Prize
No Prize	9c3f557b-aacd-4dc4-802a-fb7901054b8a	Atala Finance	No Prize
No Prize	bd0a52bd-0728-40d0-bd89-66bd60c449a1	Dreams	No Prize
No Prize	67aefdd6-331f-4444-bce7-0e2c96fc74a7	Polar	No Prize
No Prize	11d7e1f2-f8ea-47d6-9f26-f1ec8b209615	COLOSSEUM	No Prize
No Prize	2b7388da-4df6-4532-8082-4b66cb5a3d08	aiSports - Crypto Daily Fantasy Sports	No Prize
No Prize	2757965e-292b-4a89-82a1-6779dfc1beb9	Moltfluence	No Prize
No Prize	c0c8029b-4931-45bd-add8-165714fea218	XMind Capital	No Prize
No Prize	83466d06-cee2-4671-bf4d-c471b71673c0	LUTA: Luminoria Tactics	No Prize
No Prize	e941a4ac-b5be-4c91-8c09-fe20ee7e6ea7	CropPerps	No Prize
No Prize	89243de7-3381-4c7a-82af-4d3ece9f2d41	Avadix	No Prize
No Prize	c013e25b-ce0c-4518-bd53-83641cd31c73	SigmaV	No Prize
No Prize	a0e3b589-5f50-4b62-8b0d-4eff0e2bb8d3	Flare	No Prize
No Prize	40993b21-0fe8-49e4-b418-cc8870e9335d	polydraft	No Prize
No Prize	a708930f-4f63-4c32-8602-a454ff209d21	Salient Yachts	No Prize
No Prize	92aaa834-59a6-40e6-9ef0-ee3d2fa93b0d	AION YIELD	No Prize
No Prize	b3379874-2295-4699-8225-18e38c5aeea1	Composed Protocol	No Prize
No Prize	8d317210-9e5a-4196-b46c-8ea5281a9c14	PermaDEX	No Prize
No Prize	ddee0fd4-9a5b-46c6-aa32-255a04a1563b	PULSAR	No Prize
No Prize	4d64e67b-b194-408b-a685-c5b2b560ca6d	MNWalk	No Prize
No Prize	1ee0fe49-2a87-4b50-86b5-5d69cdf5fb16	MI;Re (My Implant Record)	No Prize
No Prize	b465c36a-e162-4beb-bbaa-cc185adbb9dd	MuriData	No Prize
No Prize	0a75d6cd-c36d-4b9f-8a7a-0a65eb44feac	Wasiai	No Prize
No Prize	4fca641a-79b3-480f-9d27-0e8b577dee31	Red Pepe Arcade	No Prize
No Prize	e8f69381-4405-48d6-ba55-c37b1d21fa5f	SOCI4L	No Prize
No Prize	4e5cdd9b-0c1d-474e-9e34-e89651b26f0d	Kura	No Prize
No Prize	d055e3db-c4eb-479d-bab8-5989db25308a	ProofMark	No Prize
No Prize	f0ed3048-889f-4561-812e-9b38b41d6e31	StrataDeed	No Prize
No Prize	6f77d514-cf85-48b6-9a63-c2ae933f0624	ChainBois	No Prize
No Prize	11c594d6-0bec-4bca-8c00-c7ae2832dec4	AVAJAZAMITI	No Prize
No Prize	40594c70-5ae3-4380-b69d-d4f1b35ae4e2	Starlight Armada	No Prize
No Prize	be33f0a4-5b0e-40ff-be87-c01630e83e91	Nomos Protocol	No Prize
No Prize	81f844ff-f5f0-49df-a649-3f823dcb8562	DexPal	No Prize
No Prize	b6fbee5f-64f9-47cc-bb46-e05bfc3c5e69	ExNihilo	No Prize
No Prize	8d5b51e8-99d9-4a4c-b3a2-d8c6027faa26	PeakBalance	No Prize
No Prize	279daf1d-03b9-48f5-98d0-d5167d9b2ce8	Sentinel Protocol	No Prize
No Prize	27adaf88-4096-4f25-a092-b815529ccd1b	TrendZap	No Prize
No Prize	cd9870ef-5ce8-45c8-92fb-9f9f7513eb7e	Ur Finance	No Prize
No Prize	74b91a33-7c65-47b0-a32d-466a678a1b26	Local Universe	No Prize
No Prize	1eebab23-f1c0-4c45-a043-ee32af0ed226	AvaForensics	No Prize
No Prize	33bb53df-9fc5-4499-b903-959c154c54ec	GRAFT Ecosystem	No Prize
No Prize	a661ef0b-a5e0-45cf-890b-ab960190dc97	Drift Hub	No Prize
No Prize	fc8229c6-945b-4070-b212-0757c95959fb	SportChain	No Prize
No Prize	d62bfe67-33bd-4864-8ca5-a901a546ffce	WavCash	No Prize
No Prize	9d8c3afd-7063-4ca8-9e20-c7a2aa2444f6	Sparkclub.xyz	No Prize
No Prize	73f4561e-4c97-4998-9086-fad9a76145c8	Mad Apes	No Prize
No Prize	84cac00d-1322-4622-b409-9e0e71dc951b	XRamp	No Prize
No Prize	e35fe9a4-a8d5-4cfa-878d-077717f2b396	kardpay	No Prize
No Prize	694fa9ca-1ddd-4042-a621-cc13e40f7e52	ChaiTrade	No Prize
No Prize	ae53f430-8c68-4078-8633-450864587c13	LayerCover	No Prize
No Prize	71847f63-9922-486c-929a-a9b98689f44b	Folks Mobile	No Prize
No Prize	072ca83b-3e5c-442f-ba5b-50abaa312e05	Gem Mint Strategy	No Prize
No Prize	e7d339b0-6d7b-4b87-8a58-2fa4efff79b6	PyVax	No Prize
`;

function parseRows(rawRows: string): BuildGamesStageSeedRow[] {
  return rawRows
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [bucket, projectId, projectName, memberConfirmation] = line.split('\t');
      const stage = bucket === 'Finalist' ? 4 : 3;

      return {
        bucket,
        projectId,
        projectName,
        memberConfirmation,
        stage,
        stageClassification: stage === 4 ? 'stage_4_finalist' : 'stage_3_only',
      };
    });
}

export const BUILD_GAMES_2026_STAGE_ROWS = parseRows(RAW_BUILD_GAMES_2026_STAGE_ROWS);
