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

