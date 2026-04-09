export type EventsLang = "en" | "es";

export function normalizeEventsLang(value: unknown): EventsLang {
  return value === "es" ? "es" : "en";
}

type Dict = Record<string, string>;

const dict: Record<EventsLang, Dict> = {
  en: {
    // Navigation / sections
    "menu.about": "About",
    "menu.tracks": "Prizes & Tracks",
    "menu.resources": "Resources",
    "menu.schedule": "Schedule",
    "menu.submission": "Submission",
    "menu.mentorsJudges": "Mentors & Judges",
    "menu.partners": "Partners",

    // About
    "section.about.title": "About",

    // Tracks
    "section.tracks.title": "Tracks",
    "section.tracks.totalPrizePool": "Total prize pool",
    "section.tracks.whatToBuild": "What to build",

    // Resources
    "section.resources.title": "Resources",
    "section.resources.subtitle": "Find key resources and support for your journey in {title}",

    // Submission
    "section.submission.title": "Submit Your Project",
    "section.submission.subtitle":
      "Follow the guidelines to submit your hackathon project successfully",
    "section.submission.deadline": "Deadline",
    "section.submission.submissionsCloseOn": "Submissions close on",
    "section.submission.requirements": "Requirements",
    "section.submission.requirementsText":
      "Your project must include a GitHub repo, slides for your pitch, and any additional content.",
    "section.submission.evaluationCriteria": "Evaluation Criteria",
    "section.submission.evaluationCriteriaText":
      "Projects will be judged on value proposition, technical complexity and usage of Avalanche technologies",
    "section.submission.submissionProcess": "Submission Process",
    "section.submission.submissionProcessText":
      "Submit your project through the Avalanche Builder Hub, add your team members, and upload your GitHub repo, presentation slides along with any other file that support your submission.",
    "section.submission.viewFullGuidelines": "View full guidelines",
    "section.submission.guidelinesTitle": "Guidelines",
    "section.submission.submitProject": "Submit project",

    // Schedule
    "section.schedule.title": "Schedule",
    "schedule.noDatesAvailable": "No dates available",
    "schedule.noValidDatesAvailable": "No valid dates available",
    "schedule.invalidDateRange": "Invalid date range",
    "schedule.liveNow": "Live now",
    "schedule.zoom": "Zoom",
    "schedule.untitledActivity": "Untitled Activity",
    "schedule.joinVideoCall": "Join video call",
    "schedule.tbd": "TBD",

    // Mentors & judges
    "section.mentorsJudges.title": "Mentors & Judges",
    "section.mentorsJudges.speakerPictureAlt": "speaker picture",

    // Sponsors / partners
    "section.partners.title": "Partners",
    "section.partners.subtitle": "Our partners drive the future of blockchain innovation.",
    "section.partners.becomeSponsor": "BECOME A SPONSOR",

    // Community
    "section.community.title": "Community",
    "section.community.subtitle":
      "Connect with fellow hackers, ask questions, and share your progress.",
    "community.telegram.title": "Join the Telegram chat",
    "community.team1x.title": "Avalanche Team1 X",

    // Buttons / misc
    "join.registered": "You're In",
    "join.chat": "Join the Hackathon Chat",
    "join.default": "Join now",
    "overview.learnMore": "LEARN MORE",
    "overview.hackathonTitleFallback": "Hackathon Title",
    "overview.type.hackathon": "Hackathon",
    "overview.type.workshop": "Workshop",
    "overview.type.bootcamp": "Bootcamp",

    // Metadata
    "meta.notFound.title": "Event Not Found",
    "meta.notFound.description": "The requested event could not be found",
    "meta.events.title": "Events",
    "meta.events.description":
      "Join exciting blockchain events, hackathons, workshops and bootcamps on Avalanche",
    "meta.eventsIndex.description":
      "Join exciting blockchain hackathons, workshops and bootcamps on Avalanche",

    // Events listing (global)
    "events.listing.title": "Events",
    "events.tabs.all": "All",
    "events.tabs.hackathons": "Hackathons",
    "events.tabs.workshops": "Workshops",
    "events.tabs.bootcamps": "Bootcamps",
    "events.myHackathons": "My Hackathons",
    "events.emptyActive":
      "No upcoming or ongoing events at the moment. Join our Telegram community to be the first to know about new opportunities!",
    "events.joinTelegram": "Join Telegram Group",
    "events.discoverMore": "Discover More",
    "events.discovery.avalancheCalendar.title": "Avalanche Calendar",
    "events.discovery.avalancheCalendar.description":
      "Explore upcoming Avalanche events, meetups, and community gatherings. Stay connected with the latest happenings in the ecosystem.",
    "events.discovery.communityEvents.title": "Community Events",
    "events.discovery.communityEvents.description":
      "Check out and join the global meetups, workshops and events organized by Avalanche Team1",
    "events.discovery.campusConnect.title": "Campus Connect",
    "events.discovery.campusConnect.description":
      "Discover opportunities for students and educators to explore blockchain technology and join our community of builders.",
    "events.past": "Past",
    "events.search.placeholder": "Search by name, track or location",
    "events.filter.event.placeholder": "Filter by Event",
    "events.filter.event.all": "All Events",
    "events.filter.location.placeholder": "Filter by Location",
    "events.filter.location.all": "All Locations",
    "events.filter.location.inPerson": "In Person",
    "events.pagination.pageOf": "Page {current} of {total}",
    "events.pagination.pageSize.placeholder": "Select track",

    // Project submission form — header
    "submission.form.title.withHackathon": "Submit Your Project",
    "submission.form.title.standalone": "Create New Project",
    "submission.form.subtitle.withHackathon":
      "Finalize and submit your project for review before the deadline. Complete all sections to ensure eligibility.",
    "submission.form.subtitle.standalone":
      "Fill in all the details to create your project. Complete all sections to save your project.",
    "submission.form.error.init":
      "An error occurred while initializing the project. Please try again.",
    "submission.form.toast.submitted": "Project submitted",
    "submission.form.toast.submittedDesc":
      "Your project has been successfully submitted. Redirecting to your profile...",
    "submission.form.toast.error": "Error",
    "submission.form.toast.errorDesc":
      "An error occurred while submitting the project.",

    // Step 1 — General
    "submission.step1.general.title": "General Section",
    "submission.step1.general.subtitle":
      "Provide key details about your project that will appear in listings.",
    "submission.step1.projectName.label": "Project Name",
    "submission.step1.projectName.placeholder": "Enter your project name",
    "submission.step1.shortDesc.label": "Short Description",
    "submission.step1.shortDesc.placeholder":
      "Write a short and engaging overview...",
    "submission.step1.fullDesc.label": "Full Description",
    "submission.step1.fullDesc.placeholder": "Describe your project in detail...",
    "submission.step1.tracks.label": "Tracks",
    "submission.step1.tracks.placeholder": "Select tracks",
    "submission.step1.tracks.searchPlaceholder": "Search tracks",
    "submission.step1.categories.label": "Categories",
    "submission.step1.categories.placeholder": "Select categories",
    "submission.step1.categories.searchPlaceholder": "Search categories",
    "submission.step1.otherCategory.label": "Specify Other Category",
    "submission.step1.otherCategory.placeholder": "Enter your custom category",
    "submission.step1.deployedAddresses.label": "Deployed Addresses",
    "submission.step1.deployedAddresses.addButton": "+ new address",
    "submission.step1.team.title": "Team & Collaboration",

    // Step 2 — Technical Details
    "submission.step2.technical.title": "Technical Details",
    "submission.step2.technical.subtitle":
      "Explain how your project works under the hood: tech stack, integrations, and architecture.",
    "submission.step2.techStack.label": "How it's made",
    "submission.step2.techStack.placeholder":
      "Describe the tech stack, APIs, and integrations used.",
    "submission.step2.techStack.hint":
      'Mention any innovative solutions or "hacky" parts worth highlighting.',
    "submission.step2.github.label": "GitHub Repository",
    "submission.step2.github.placeholder":
      "Paste GitHub link (e.g., https://github.com/user/repo)",
    "submission.step2.github.validation":
      "Must be a public repository. If design-only, link a Figma file. Use space, enter or tab after each link",
    "submission.step2.demo.label": "Demo and Other Links",
    "submission.step2.demo.placeholder":
      "Paste any project links (e.g., https://yoursite.com)",
    "submission.step2.demo.validation":
      "Provide a live demo, presentation, deck, Google Drive Folder, website, etc. Use space, enter or tab after each link",
    "submission.step2.continuity.title": "Project Continuity & Development",
    "submission.step2.continuity.subtitle":
      "Indicate if your project builds upon a pre-existing idea and clarify your contributions during the hackathon.",
    "submission.step2.preexisting.label":
      "Is this project based on a pre-existing idea?",
    "submission.step2.preexisting.description1":
      "If your project is built upon an existing idea, you must disclose which components were developed specifically during the hackathon.",
    "submission.step2.preexisting.description2":
      "Judges may not have enough time to fully verify the implementation during evaluation, but prize distribution may be subject to further review.",
    "submission.step2.explanation.label":
      "Explain what was built during the hackathon",
    "submission.step2.explanation.placeholder":
      "Provide a detailed breakdown of the new features, functionalities, or improvements developed during this event.",
    "submission.step2.explanation.hint1":
      "Clearly specify what was created during the hackathon.",
    "submission.step2.explanation.hint2":
      "Differentiate between pre-existing work and new contributions.",
    "submission.step2.explanation.hint3":
      "Mention any significant modifications or optimizations.",

    // Step 3 — Media
    "submission.step3.media.title": "3) Visual Identity & Media",
    "submission.step3.media.subtitle":
      "Upload images and media to visually represent your project.",
    "submission.step3.logo.label": "Project Logo",
    "submission.step3.logo.button": "Upload Logo",
    "submission.step3.cover.label": "Cover Image",
    "submission.step3.cover.button": "Upload Cover Image",
    "submission.step3.screenshots.label": "Screenshots",
    "submission.step3.screenshots.extraText":
      "Upload up to 5 screenshots that showcase your project.",
    "submission.step3.screenshots.button": "Upload Screenshots",
    "submission.step3.demoVideo.label": "Demo Video",
    "submission.step3.demoVideo.placeholder":
      "Paste your video link (e.g., YouTube, Vimeo, or other supported platform)",
    "submission.step3.demoVideo.hint":
      "Showcase your project in action with a short demo video. Ensure the link is accessible and not set to private.",
    "submission.step3.demoVideo.requirements":
      "Video requirements: Minimum resolution 720p · Clear audio, no background music · Platforms: YouTube, Vimeo, Google Drive (public link)",

    // Step navigation
    "submission.nav.finalSubmit": "Final Submit",
    "submission.nav.continue": "Continue",
    "submission.nav.saveLater": "Save & Continue Later",
    "submission.nav.saving": "Saving...",
    "submission.nav.stepOf": "Step {current} of {total}",
    "submission.nav.next": "Next",
    "submission.nav.previous": "Previous",

    // Members
    "submission.members.inviteButton": "Invite Team Member",
    "submission.members.modal.title": "Invite Member",
    "submission.members.modal.description":
      "Enter the email addresses of the persons you want to invite to your team and then press Enter. When you've added all emails, click on Send Invitation.",
    "submission.members.modal.emailPlaceholder": "Add email...",
    "submission.members.modal.invalidEmails":
      "Some emails are not registered on the platform.",
    "submission.members.modal.sendButton": "Send Invitation",
    "submission.members.modal.sending": "Sending...",
    "submission.members.modal.successTitle": "Invitation Sent!",
    "submission.members.modal.successDesc":
      "Invitation sent successfully to {emails}. They will receive an email to join your team. You can also copy the links and send them manually.",
    "submission.members.modal.failTitle": "Invitation Failed!",
    "submission.members.modal.failDesc":
      "We've got some errors sending the invitations, but here are the links for you to send them manually:",
    "submission.members.modal.done": "Done",
    "submission.members.table.name": "Name",
    "submission.members.table.email": "Email",
    "submission.members.table.role": "Role",
    "submission.members.table.status": "Status",
    "submission.members.table.resend": "Resend Invitation",
    "submission.members.table.remove": "Remove Member",
    "submission.members.table.status.confirmed": "Confirmed",
    "submission.members.table.status.pending": "Pending",
    "submission.members.role.member": "Member",
    "submission.members.role.developer": "Developer",
    "submission.members.role.pm": "PM",
    "submission.members.role.researcher": "Researcher",
    "submission.members.role.designer": "Designer",
    "submission.progress.complete": "{progress}% Complete - Finish your submission!",

    // MediaUploader
    "submission.media.fileRequirements": "File requirements: PNG, JPG, SVG",
    "submission.media.recommendedSize": "Recommended size: {size}",
    "submission.media.maxSize": "Max file size: {size}MB",
    "submission.media.view": "View",
    "submission.media.replace": "Replace",
    "submission.media.delete": "Delete",
    "submission.media.deleteTitle": "Delete Image",
    "submission.media.deleteConfirm": "Are you sure you want to delete this image?",
    "submission.media.viewTitle": "View Image",

    // Save toasts
    "submission.save.savedTitle": "Project saved",
    "submission.save.savedDesc": "Your project has been saved successfully.",
    "submission.save.savedRedirectDesc": "Your project has been saved. Redirecting to your profile...",
    "submission.save.errorDesc": "An error occurred while saving the project.",

    // Registration form — header & nav
    "reg.form.title": "Registration form for {title} (Step {step}/3)",
    "reg.form.continue": "Continue",
    "reg.form.saveLater": "Save & Continue Later",
    "reg.form.saveExit": "Save & Exit",
    "reg.form.saving": "Saving...",
    "reg.form.next": "Next",
    "reg.form.previous": "Previous",
    "reg.form.stepOf": "Step {current} of {total}",

    // Step 1
    "reg.step1.title": "Step 1: Personal Information",
    "reg.step1.subtitle": "Provide your personal details to create your Builder Hub profile.",
    "reg.step1.name.label": "Full Name or Nickname *",
    "reg.step1.name.placeholder": "Enter your full name or preferred display name",
    "reg.step1.name.hint": "This name will be used for your profile and communications.",
    "reg.step1.email.label": "Email Address *",
    "reg.step1.email.hint": "This email will be used for login and communications.",
    "reg.step1.company.label": "Company/University (if applicable)",
    "reg.step1.company.placeholder": "Enter your company/University name",
    "reg.step1.company.hint": "If you are part of a company or affiliated with a university, mention it here. Otherwise, leave blank.",
    "reg.step1.role.label": "Role at Company",
    "reg.step1.role.placeholder": "Select your role",
    "reg.step1.role.hint": "Select the option that best matches your role.",
    "reg.step1.country.label": "Country of Residence *",
    "reg.step1.country.placeholder": "Select your country",
    "reg.step1.country.hint": "This will help us bring in-person events closer to you.",
    "reg.step1.telegram.label": "Telegram Username *",
    "reg.step1.telegram.placeholder": "Enter your Telegram username (without @)",
    "reg.step1.additional.title": "Additional Information",
    "reg.step1.founder.label": "Are you a founder or co-founder of a blockchain project?",
    "reg.step1.ecosystem.label": "Consider yourself an Avalanche ecosystem member?",

    // Step 2
    "reg.step2.title": "Step 2: Experience & Skills",
    "reg.step2.subtitle": "Share your skills and expertise to tailor your experience on Builder Hub. All questions in this step are optional.",
    "reg.step2.multiSelect.placeholder": "Select one or more options (optional)",
    "reg.step2.multiSelect.selected": "{count} options selected",
    "reg.step2.web3.label": "What is your proficiency with Web3? (Amateur, 5 = Expert) (Optional)",
    "reg.step2.web3.placeholder": "Select your Web3 knowledge level (optional)",
    "reg.step2.web3.hint": "Rate your experience from beginner to expert.",
    "reg.step2.roles.label": "Which of the following best describes you? (Optional)",
    "reg.step2.roles.hint": "Choose roles that best represent your expertise.",
    "reg.step2.interests.label": "What are you most interested in within Web3? (Optional)",
    "reg.step2.interests.hint": "Choose the topics you want to explore further.",
    "reg.step2.tools.label": "Which tools are you familiar with? (Optional)",
    "reg.step2.tools.hint": "Select platforms or technologies you have experience with.",
    "reg.step2.languages.label": "Which programming languages are you familiar with? (Optional)",
    "reg.step2.languages.hint": "Choose all that apply.",
    "reg.step2.hackathon.label": "Have you participated in any other hackathons before? (Optional)",
    "reg.step2.hackathon.placeholder": "Select an option (optional)",
    "reg.step2.hackathon.hint": "Let us know if this is your first hackathon or if you have prior experience.",
    "reg.step2.github.label": "What's your GitHub or Portfolio account? (Optional)",
    "reg.step2.github.placeholder": "Enter your GitHub or Portfolio link (optional)",
    "reg.step2.github.hint": "Provide a link to showcase your past work (optional).",

    // Step 3
    "reg.step3.title": "Step 3: Terms & Agreements",
    "reg.step3.subtitle": "Review and agree to the terms to complete your registration. For information about our privacy practices and commitment to protecting your privacy, please review our",
    "reg.step3.privacyLink": "Avalanche Privacy Policy.",
    "reg.step3.terms.label": "I have read and agree to the Event Participation",
    "reg.step3.terms.link": "Terms and Conditions.",
    "reg.step3.terms.hint": "You must agree to participate in any Builder Hub events. Event Terms and Conditions.",
    "reg.step3.newsletter.label": "I wish to stay informed about Avalanche news and events.",
    "reg.step3.newsletter.hint": "Subscribe to newsletters and promotional materials. You can opt out anytime.",
    "reg.step3.prohibited.label": "I agree not to bring any of the following prohibited items. *",
    "reg.step3.prohibited.hint": "Review the list of restricted items before attending in-person events.",

    // Completed dialog
    "reg.dialog.title": "Application Submitted",
    "reg.dialog.body": "Your application has been Approved. Join the",
    "reg.dialog.telegramLink": "Telegram group",
    "reg.dialog.bodyEnd": "to get all the support you need.",

    // Referral
    "referral.button.label": "Refer a Friend",
    "referral.modal.title": "Refer a Friend",
    "referral.modal.description": "Share {title} with your network. When someone registers using your link, they'll be attributed to you.",
    "referral.modal.handleLabel": "Your X (Twitter) Handle",
    "referral.modal.generate": "Generate",
    "referral.modal.yourLink": "Your Referral Link",
    "referral.modal.copy": "Copy link",
    "referral.modal.shareOn": "Share on",
    "referral.share.xText": "Join me at {title} — a hackathon on Avalanche! Register here: {link}",
    "referral.share.linkedinText": "Join me at {title} — a hackathon on Avalanche! Register here: {link}",
  },
  es: {
    // Navigation / sections
    "menu.about": "Acerca de",
    "menu.tracks": "Premios y tracks",
    "menu.resources": "Recursos",
    "menu.schedule": "Agenda",
    "menu.submission": "Envío",
    "menu.mentorsJudges": "Mentores y jurado",
    "menu.partners": "Partners",

    // About
    "section.about.title": "Acerca de",

    // Tracks
    "section.tracks.title": "Tracks",
    "section.tracks.totalPrizePool": "Bolsa total de premios",
    "section.tracks.whatToBuild": "Qué construir",

    // Resources
    "section.resources.title": "Recursos",
    "section.resources.subtitle":
      "Encuentra recursos clave y apoyo para tu recorrido en {title}",

    // Submission
    "section.submission.title": "Envía tu proyecto",
    "section.submission.subtitle":
      "Sigue las pautas para enviar tu proyecto del hackathon correctamente",
    "section.submission.deadline": "Fecha límite",
    "section.submission.submissionsCloseOn": "Los envíos cierran el",
    "section.submission.requirements": "Requisitos",
    "section.submission.requirementsText":
      "Tu proyecto debe incluir un repo en GitHub, diapositivas para tu pitch y cualquier contenido adicional.",
    "section.submission.evaluationCriteria": "Criterios de evaluación",
    "section.submission.evaluationCriteriaText":
      "Los proyectos se evaluarán por propuesta de valor, complejidad técnica y uso de tecnologías de Avalanche",
    "section.submission.submissionProcess": "Proceso de envío",
    "section.submission.submissionProcessText":
      "Envía tu proyecto a través de Avalanche Builder Hub, añade a tu equipo y sube tu repo de GitHub, las diapositivas de la presentación y cualquier otro archivo que respalde tu envío.",
    "section.submission.viewFullGuidelines": "Ver pautas completas",
    "section.submission.guidelinesTitle": "Pautas",
    "section.submission.submitProject": "Enviar proyecto",

    // Schedule
    "section.schedule.title": "Agenda",
    "schedule.noDatesAvailable": "No hay fechas disponibles",
    "schedule.noValidDatesAvailable": "No hay fechas válidas disponibles",
    "schedule.invalidDateRange": "Rango de fechas inválido",
    "schedule.liveNow": "En vivo",
    "schedule.zoom": "Zoom",
    "schedule.untitledActivity": "Actividad sin título",
    "schedule.joinVideoCall": "Unirse a videollamada",
    "schedule.tbd": "Por confirmar",

    // Mentors & judges
    "section.mentorsJudges.title": "Mentores y jurado",
    "section.mentorsJudges.speakerPictureAlt": "foto del speaker",

    // Sponsors / partners
    "section.partners.title": "Partners",
    "section.partners.subtitle":
      "Nuestros partners impulsan el futuro de la innovación en blockchain.",
    "section.partners.becomeSponsor": "CONVIÉRTETE EN SPONSOR",

    // Community
    "section.community.title": "Comunidad",
    "section.community.subtitle":
      "Conéctate con otros hackers, haz preguntas y comparte tu progreso.",
    "community.telegram.title": "Únete al chat de Telegram",
    "community.team1x.title": "Avalanche Team1 X",

    // Buttons / misc
    "join.registered": "Ya estás dentro",
    "join.chat": "Únete al chat del hackathon",
    "join.default": "Unirse ahora",
    "overview.learnMore": "SABER MÁS",
    "overview.hackathonTitleFallback": "Título del hackathon",
    "overview.type.hackathon": "Hackathon",
    "overview.type.workshop": "Workshop",
    "overview.type.bootcamp": "Bootcamp",

    // Metadata
    "meta.notFound.title": "Evento no encontrado",
    "meta.notFound.description": "No se pudo encontrar el evento solicitado",
    "meta.events.title": "Eventos",
    "meta.events.description":
      "Únete a eventos de blockchain, hackathons, workshops y bootcamps en Avalanche",
    "meta.eventsIndex.description":
      "Únete a hackathons, workshops y bootcamps de blockchain en Avalanche",

    // Events listing (global)
    "events.listing.title": "Eventos",
    "events.tabs.all": "Todos",
    "events.tabs.hackathons": "Hackathons",
    "events.tabs.workshops": "Workshops",
    "events.tabs.bootcamps": "Bootcamps",
    "events.myHackathons": "Mis hackathons",
    "events.emptyActive":
      "No hay eventos próximos o en curso por el momento. Únete a nuestra comunidad de Telegram para enterarte primero de nuevas oportunidades.",
    "events.joinTelegram": "Unirse al grupo de Telegram",
    "events.discoverMore": "Descubre más",
    "events.discovery.avalancheCalendar.title": "Calendario de Avalanche",
    "events.discovery.avalancheCalendar.description":
      "Explora próximos eventos de Avalanche, meetups y encuentros de la comunidad. Mantente al día con lo último del ecosistema.",
    "events.discovery.communityEvents.title": "Eventos de la comunidad",
    "events.discovery.communityEvents.description":
      "Descubre y únete a meetups, workshops y eventos globales organizados por Avalanche Team1",
    "events.discovery.campusConnect.title": "Campus Connect",
    "events.discovery.campusConnect.description":
      "Descubre oportunidades para estudiantes y docentes para explorar blockchain y unirse a nuestra comunidad de builders.",
    "events.past": "Pasados",
    "events.search.placeholder": "Buscar por nombre, track o ubicación",
    "events.filter.event.placeholder": "Filtrar por evento",
    "events.filter.event.all": "Todos los eventos",
    "events.filter.location.placeholder": "Filtrar por ubicación",
    "events.filter.location.all": "Todas las ubicaciones",
    "events.filter.location.inPerson": "Presencial",
    "events.pagination.pageOf": "Página {current} de {total}",
    "events.pagination.pageSize.placeholder": "Seleccionar track",

    // Project submission form — header
    "submission.form.title.withHackathon": "Envía tu proyecto",
    "submission.form.title.standalone": "Crear nuevo proyecto",
    "submission.form.subtitle.withHackathon":
      "Finaliza y envía tu proyecto para revisión antes de la fecha límite. Completa todas las secciones para asegurar tu elegibilidad.",
    "submission.form.subtitle.standalone":
      "Completa todos los detalles para crear tu proyecto. Llena todas las secciones para guardar tu proyecto.",
    "submission.form.error.init":
      "Ocurrió un error al inicializar el proyecto. Por favor, intenta de nuevo.",
    "submission.form.toast.submitted": "Proyecto enviado",
    "submission.form.toast.submittedDesc":
      "Tu proyecto fue enviado exitosamente. Redirigiendo a tu perfil...",
    "submission.form.toast.error": "Error",
    "submission.form.toast.errorDesc":
      "Ocurrió un error al enviar el proyecto.",

    // Step 1 — General
    "submission.step1.general.title": "Sección general",
    "submission.step1.general.subtitle":
      "Proporciona los detalles clave de tu proyecto que aparecerán en los listados.",
    "submission.step1.projectName.label": "Nombre del proyecto",
    "submission.step1.projectName.placeholder":
      "Ingresa el nombre de tu proyecto",
    "submission.step1.shortDesc.label": "Descripción corta",
    "submission.step1.shortDesc.placeholder":
      "Escribe un resumen corto y atractivo...",
    "submission.step1.fullDesc.label": "Descripción completa",
    "submission.step1.fullDesc.placeholder":
      "Describe tu proyecto en detalle...",
    "submission.step1.tracks.label": "Tracks",
    "submission.step1.tracks.placeholder": "Selecciona tracks",
    "submission.step1.tracks.searchPlaceholder": "Buscar tracks",
    "submission.step1.categories.label": "Categorías",
    "submission.step1.categories.placeholder": "Selecciona categorías",
    "submission.step1.categories.searchPlaceholder": "Buscar categorías",
    "submission.step1.otherCategory.label": "Especifica otra categoría",
    "submission.step1.otherCategory.placeholder":
      "Ingresa tu categoría personalizada",
    "submission.step1.deployedAddresses.label": "Direcciones desplegadas",
    "submission.step1.deployedAddresses.addButton": "+ nueva dirección",
    "submission.step1.team.title": "Equipo y colaboración",

    // Step 2 — Technical Details
    "submission.step2.technical.title": "Detalles técnicos",
    "submission.step2.technical.subtitle":
      "Explica cómo funciona tu proyecto internamente: stack tecnológico, integraciones y arquitectura.",
    "submission.step2.techStack.label": "Cómo está hecho",
    "submission.step2.techStack.placeholder":
      "Describe el stack tecnológico, APIs e integraciones utilizadas.",
    "submission.step2.techStack.hint":
      'Menciona cualquier solución innovadora o partes "hacky" que valgan la pena destacar.',
    "submission.step2.github.label": "Repositorio de GitHub",
    "submission.step2.github.placeholder":
      "Pega el link de GitHub (ej. https://github.com/usuario/repo)",
    "submission.step2.github.validation":
      "Debe ser un repositorio público. Si es solo diseño, vincula un archivo Figma. Usa espacio, enter o tab después de cada link",
    "submission.step2.demo.label": "Demo y otros links",
    "submission.step2.demo.placeholder":
      "Pega cualquier link del proyecto (ej. https://tusitio.com)",
    "submission.step2.demo.validation":
      "Incluye un demo en vivo, presentación, deck, carpeta de Google Drive, sitio web, etc. Usa espacio, enter o tab después de cada link",
    "submission.step2.continuity.title": "Continuidad y desarrollo del proyecto",
    "submission.step2.continuity.subtitle":
      "Indica si tu proyecto se basa en una idea preexistente y clarifica tus contribuciones durante el hackathon.",
    "submission.step2.preexisting.label":
      "¿Este proyecto está basado en una idea preexistente?",
    "submission.step2.preexisting.description1":
      "Si tu proyecto se construye sobre una idea existente, debes declarar qué componentes fueron desarrollados específicamente durante el hackathon.",
    "submission.step2.preexisting.description2":
      "Los jueces pueden no tener tiempo suficiente para verificar completamente la implementación durante la evaluación, pero la distribución de premios puede estar sujeta a revisión adicional.",
    "submission.step2.explanation.label":
      "Explica qué se construyó durante el hackathon",
    "submission.step2.explanation.placeholder":
      "Proporciona un desglose detallado de las nuevas funcionalidades o mejoras desarrolladas durante este evento.",
    "submission.step2.explanation.hint1":
      "Especifica claramente qué fue creado durante el hackathon.",
    "submission.step2.explanation.hint2":
      "Diferencia entre el trabajo preexistente y las nuevas contribuciones.",
    "submission.step2.explanation.hint3":
      "Menciona cualquier modificación u optimización significativa.",

    // Step 3 — Media
    "submission.step3.media.title": "3) Identidad visual y medios",
    "submission.step3.media.subtitle":
      "Sube imágenes y medios para representar visualmente tu proyecto.",
    "submission.step3.logo.label": "Logo del proyecto",
    "submission.step3.logo.button": "Subir logo",
    "submission.step3.cover.label": "Imagen de portada",
    "submission.step3.cover.button": "Subir imagen de portada",
    "submission.step3.screenshots.label": "Capturas de pantalla",
    "submission.step3.screenshots.extraText":
      "Sube hasta 5 capturas de pantalla que muestren tu proyecto.",
    "submission.step3.screenshots.button": "Subir capturas",
    "submission.step3.demoVideo.label": "Video demo",
    "submission.step3.demoVideo.placeholder":
      "Pega tu link de video (ej. YouTube, Vimeo u otra plataforma compatible)",
    "submission.step3.demoVideo.hint":
      "Muestra tu proyecto en acción con un video demo corto. Asegúrate de que el link sea accesible y no esté en privado.",
    "submission.step3.demoVideo.requirements":
      "Requisitos del video: Resolución mínima 720p · Audio claro, sin música de fondo · Plataformas: YouTube, Vimeo, Google Drive (link público)",

    // Step navigation
    "submission.nav.finalSubmit": "Envío final",
    "submission.nav.continue": "Continuar",
    "submission.nav.saveLater": "Guardar y continuar después",
    "submission.nav.saving": "Guardando...",
    "submission.nav.stepOf": "Paso {current} de {total}",
    "submission.nav.next": "Siguiente",
    "submission.nav.previous": "Anterior",

    // Members
    "submission.members.inviteButton": "Invitar miembro",
    "submission.members.modal.title": "Invitar miembro",
    "submission.members.modal.description":
      "Ingresa los correos de las personas que quieres invitar a tu equipo y presiona Enter. Cuando hayas añadido todos los correos, haz clic en Enviar invitación.",
    "submission.members.modal.emailPlaceholder": "Añadir correo...",
    "submission.members.modal.invalidEmails":
      "Algunos correos no están registrados en la plataforma.",
    "submission.members.modal.sendButton": "Enviar invitación",
    "submission.members.modal.sending": "Enviando...",
    "submission.members.modal.successTitle": "¡Invitación enviada!",
    "submission.members.modal.successDesc":
      "Invitación enviada exitosamente a {emails}. Recibirán un correo para unirse a tu equipo. También puedes copiar los links y enviarlos manualmente.",
    "submission.members.modal.failTitle": "¡Error al enviar invitación!",
    "submission.members.modal.failDesc":
      "Hubo errores al enviar las invitaciones, pero aquí están los links para que los envíes manualmente:",
    "submission.members.modal.done": "Listo",
    "submission.members.table.name": "Nombre",
    "submission.members.table.email": "Correo",
    "submission.members.table.role": "Rol",
    "submission.members.table.status": "Estado",
    "submission.members.table.resend": "Reenviar invitación",
    "submission.members.table.remove": "Eliminar miembro",
    "submission.members.table.status.confirmed": "Confirmado",
    "submission.members.table.status.pending": "Pendiente",
    "submission.members.role.member": "Miembro",
    "submission.members.role.developer": "Desarrollador",
    "submission.members.role.pm": "PM",
    "submission.members.role.researcher": "Investigador",
    "submission.members.role.designer": "Diseñador",
    "submission.progress.complete": "{progress}% Completado - ¡Termina tu envío!",

    // MediaUploader
    "submission.media.fileRequirements": "Requisitos: PNG, JPG, SVG",
    "submission.media.recommendedSize": "Tamaño recomendado: {size}",
    "submission.media.maxSize": "Tamaño máximo: {size}MB",
    "submission.media.view": "Ver",
    "submission.media.replace": "Reemplazar",
    "submission.media.delete": "Eliminar",
    "submission.media.deleteTitle": "Eliminar imagen",
    "submission.media.deleteConfirm": "¿Estás seguro de que quieres eliminar esta imagen?",
    "submission.media.viewTitle": "Ver imagen",

    // Save toasts
    "submission.save.savedTitle": "Proyecto guardado",
    "submission.save.savedDesc": "Tu proyecto ha sido guardado exitosamente.",
    "submission.save.savedRedirectDesc": "Tu proyecto ha sido guardado. Redirigiendo a tu perfil...",
    "submission.save.errorDesc": "Ocurrió un error al guardar el proyecto.",

    // Registration form — header & nav
    "reg.form.title": "Formulario de registro para {title} (Paso {step}/3)",
    "reg.form.continue": "Continuar",
    "reg.form.saveLater": "Guardar y continuar después",
    "reg.form.saveExit": "Guardar y salir",
    "reg.form.saving": "Guardando...",
    "reg.form.next": "Siguiente",
    "reg.form.previous": "Anterior",
    "reg.form.stepOf": "Paso {current} de {total}",

    // Step 1
    "reg.step1.title": "Paso 1: Información personal",
    "reg.step1.subtitle": "Proporciona tus datos personales para crear tu perfil en Builder Hub.",
    "reg.step1.name.label": "Nombre completo o apodo *",
    "reg.step1.name.placeholder": "Ingresa tu nombre completo o nombre para mostrar",
    "reg.step1.name.hint": "Este nombre se usará en tu perfil y comunicaciones.",
    "reg.step1.email.label": "Correo electrónico *",
    "reg.step1.email.hint": "Este correo se usará para iniciar sesión y comunicaciones.",
    "reg.step1.company.label": "Empresa/Universidad (si aplica)",
    "reg.step1.company.placeholder": "Ingresa el nombre de tu empresa/universidad",
    "reg.step1.company.hint": "Si eres parte de una empresa o estás afiliado a una universidad, menciónalo aquí. De lo contrario, déjalo en blanco.",
    "reg.step1.role.label": "Rol en la empresa",
    "reg.step1.role.placeholder": "Selecciona tu rol",
    "reg.step1.role.hint": "Selecciona la opción que mejor describa tu rol.",
    "reg.step1.country.label": "País de residencia *",
    "reg.step1.country.placeholder": "Selecciona tu país",
    "reg.step1.country.hint": "Esto nos ayudará a acercar eventos presenciales a tu ubicación.",
    "reg.step1.telegram.label": "Usuario de Telegram *",
    "reg.step1.telegram.placeholder": "Ingresa tu usuario de Telegram (sin @)",
    "reg.step1.additional.title": "Información adicional",
    "reg.step1.founder.label": "¿Eres fundador o cofundador de un proyecto blockchain?",
    "reg.step1.ecosystem.label": "¿Te consideras miembro del ecosistema Avalanche?",

    // Step 2
    "reg.step2.title": "Paso 2: Experiencia y habilidades",
    "reg.step2.subtitle": "Comparte tus habilidades y experiencia para personalizar tu experiencia en Builder Hub. Todas las preguntas en este paso son opcionales.",
    "reg.step2.multiSelect.placeholder": "Selecciona una o más opciones (opcional)",
    "reg.step2.multiSelect.selected": "{count} opciones seleccionadas",
    "reg.step2.web3.label": "¿Cuál es tu nivel con Web3? (1 = Principiante, 5 = Experto) (Opcional)",
    "reg.step2.web3.placeholder": "Selecciona tu nivel de conocimiento en Web3 (opcional)",
    "reg.step2.web3.hint": "Califica tu experiencia de principiante a experto.",
    "reg.step2.roles.label": "¿Cuál de las siguientes opciones te describe mejor? (Opcional)",
    "reg.step2.roles.hint": "Elige los roles que mejor representen tu experiencia.",
    "reg.step2.interests.label": "¿Qué te interesa más dentro de Web3? (Opcional)",
    "reg.step2.interests.hint": "Elige los temas que quieres explorar más.",
    "reg.step2.tools.label": "¿Con qué herramientas estás familiarizado? (Opcional)",
    "reg.step2.tools.hint": "Selecciona plataformas o tecnologías con las que tienes experiencia.",
    "reg.step2.languages.label": "¿Qué lenguajes de programación conoces? (Opcional)",
    "reg.step2.languages.hint": "Elige todos los que apliquen.",
    "reg.step2.hackathon.label": "¿Has participado en otros hackathons antes? (Opcional)",
    "reg.step2.hackathon.placeholder": "Selecciona una opción (opcional)",
    "reg.step2.hackathon.hint": "Cuéntanos si es tu primer hackathon o si tienes experiencia previa.",
    "reg.step2.github.label": "¿Cuál es tu GitHub o portafolio? (Opcional)",
    "reg.step2.github.placeholder": "Ingresa tu link de GitHub o portafolio (opcional)",
    "reg.step2.github.hint": "Incluye un link para mostrar tu trabajo anterior (opcional).",

    // Step 3
    "reg.step3.title": "Paso 3: Términos y acuerdos",
    "reg.step3.subtitle": "Revisa y acepta los términos para completar tu registro. Para más información sobre nuestras prácticas de privacidad, consulta nuestra",
    "reg.step3.privacyLink": "Política de privacidad de Avalanche.",
    "reg.step3.terms.label": "He leído y acepto los",
    "reg.step3.terms.link": "Términos y condiciones de participación en el evento.",
    "reg.step3.terms.hint": "Debes aceptar los términos para participar en eventos de Builder Hub.",
    "reg.step3.newsletter.label": "Deseo mantenerme informado sobre noticias y eventos de Avalanche.",
    "reg.step3.newsletter.hint": "Suscríbete a boletines y materiales promocionales. Puedes cancelar en cualquier momento.",
    "reg.step3.prohibited.label": "Acepto no traer ninguno de los artículos prohibidos. *",
    "reg.step3.prohibited.hint": "Revisa la lista de artículos restringidos antes de asistir a eventos presenciales.",

    // Completed dialog
    "reg.dialog.title": "Solicitud enviada",
    "reg.dialog.body": "Tu solicitud ha sido aprobada. Únete al",
    "reg.dialog.telegramLink": "grupo de Telegram",
    "reg.dialog.bodyEnd": "para obtener todo el apoyo que necesitas.",

    // Referral
    "referral.button.label": "Invitar a un amigo",
    "referral.modal.title": "Invitar a un amigo",
    "referral.modal.description": "Comparte {title} con tu red. Cuando alguien se registre con tu enlace, se te atribuirá el referido.",
    "referral.modal.handleLabel": "Tu usuario de X (Twitter)",
    "referral.modal.generate": "Generar",
    "referral.modal.yourLink": "Tu enlace de referido",
    "referral.modal.copy": "Copiar enlace",
    "referral.modal.shareOn": "Compartir en",
    "referral.share.xText": "Únete a {title} — un hackathon en Avalanche. Regístrate aquí: {link}",
    "referral.share.linkedinText": "Únete a {title} — un hackathon en Avalanche. Regístrate aquí: {link}",
  },
};

export function t(
  lang: EventsLang,
  key: keyof (typeof dict)["en"],
  vars?: Record<string, string | number | undefined>,
): string {
  const template = dict[lang][key] ?? dict.en[key] ?? String(key);
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ""));
}

