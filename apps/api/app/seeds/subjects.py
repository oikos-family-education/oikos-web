"""Platform-provided seed subjects for Oikos."""

PLATFORM_SUBJECTS = [
    # Core Academic
    {"name": "Early Literacy", "slug": "early-literacy", "category": "core_academic", "color": "#6366F1", "icon": "BookOpen", "min_age_years": 3, "max_age_years": 7, "default_session_duration_minutes": 30, "default_weekly_frequency": 5, "short_description": "Foundation reading and language skills for young learners."},
    {"name": "Early Numeracy", "slug": "early-numeracy", "category": "core_academic", "color": "#8B5CF6", "icon": "Hash", "min_age_years": 3, "max_age_years": 7, "default_session_duration_minutes": 30, "default_weekly_frequency": 5, "short_description": "Number sense, counting, and early maths concepts."},
    {"name": "Phonics", "slug": "phonics", "category": "core_academic", "color": "#EC4899", "icon": "Volume2", "min_age_years": 4, "max_age_years": 8, "default_session_duration_minutes": 20, "default_weekly_frequency": 5, "short_description": "Letter sounds, blending, and decoding skills."},
    {"name": "Reading", "slug": "reading", "category": "core_academic", "color": "#3B82F6", "icon": "BookOpen", "min_age_years": 5, "max_age_years": 12, "default_session_duration_minutes": 30, "default_weekly_frequency": 5, "short_description": "Fluency, comprehension, and a love of literature."},
    {"name": "Handwriting / Penmanship", "slug": "handwriting-penmanship", "category": "core_academic", "color": "#F59E0B", "icon": "PenTool", "min_age_years": 5, "max_age_years": 12, "default_session_duration_minutes": 15, "default_weekly_frequency": 5, "short_description": "Letter formation, neatness, and writing fluency."},
    {"name": "Mathematics", "slug": "mathematics", "category": "core_academic", "color": "#10B981", "icon": "Calculator", "min_age_years": 5, "max_age_years": 18, "default_session_duration_minutes": 45, "default_weekly_frequency": 5, "short_description": "Arithmetic, algebra, geometry, and beyond."},
    {"name": "Language Arts / English", "slug": "language-arts-english", "category": "core_academic", "color": "#6366F1", "icon": "FileText", "min_age_years": 5, "max_age_years": 18, "default_session_duration_minutes": 45, "default_weekly_frequency": 5, "short_description": "Grammar, vocabulary, reading comprehension, and composition."},
    {"name": "Writing & Composition", "slug": "writing-composition", "category": "core_academic", "color": "#8B5CF6", "icon": "Edit3", "min_age_years": 8, "max_age_years": 18, "default_session_duration_minutes": 45, "default_weekly_frequency": 3, "short_description": "Essays, creative writing, and structured composition."},
    {"name": "History & Geography", "slug": "history-geography", "category": "core_academic", "color": "#F97316", "icon": "Globe", "min_age_years": 6, "max_age_years": 18, "default_session_duration_minutes": 45, "default_weekly_frequency": 4, "short_description": "World history, civilisations, maps, and cultures."},
    {"name": "Science", "slug": "science", "category": "core_academic", "color": "#14B8A6", "icon": "Microscope", "min_age_years": 6, "max_age_years": 18, "default_session_duration_minutes": 45, "default_weekly_frequency": 4, "short_description": "Biology, chemistry, physics, and the natural world."},

    # Language
    {"name": "Latin", "slug": "latin", "category": "language", "color": "#7C3AED", "icon": "Languages", "min_age_years": 9, "max_age_years": 18, "default_session_duration_minutes": 30, "default_weekly_frequency": 4, "short_description": "Classical Latin grammar, vocabulary, and translation."},
    {"name": "Spanish", "slug": "spanish", "category": "language", "color": "#EF4444", "icon": "Languages", "min_age_years": 5, "max_age_years": 18, "default_session_duration_minutes": 30, "default_weekly_frequency": 4, "short_description": "Conversational and written Spanish."},
    {"name": "French", "slug": "french", "category": "language", "color": "#3B82F6", "icon": "Languages", "min_age_years": 5, "max_age_years": 18, "default_session_duration_minutes": 30, "default_weekly_frequency": 4, "short_description": "Conversational and written French."},

    # Scripture & Theology
    {"name": "Scripture / Bible", "slug": "scripture-bible", "category": "scripture_theology", "color": "#92400E", "icon": "Book", "min_age_years": 4, "max_age_years": 18, "default_session_duration_minutes": 30, "default_weekly_frequency": 5, "short_description": "Bible reading, memory, and devotional study."},
    {"name": "Catechism", "slug": "catechism", "category": "scripture_theology", "color": "#78350F", "icon": "BookMarked", "min_age_years": 6, "max_age_years": 16, "default_session_duration_minutes": 20, "default_weekly_frequency": 3, "short_description": "Systematic doctrinal instruction through question and answer."},
    {"name": "Church History", "slug": "church-history", "category": "scripture_theology", "color": "#A16207", "icon": "Landmark", "min_age_years": 10, "max_age_years": 18, "default_session_duration_minutes": 40, "default_weekly_frequency": 2, "short_description": "The story of the church from the apostles to the present."},

    # Arts
    {"name": "Music Theory", "slug": "music-theory", "category": "arts", "color": "#D946EF", "icon": "Music", "min_age_years": 6, "max_age_years": 18, "default_session_duration_minutes": 30, "default_weekly_frequency": 3, "short_description": "Notes, rhythm, scales, and musical understanding."},
    {"name": "Instrument Practice", "slug": "instrument-practice", "category": "arts", "color": "#A855F7", "icon": "Music", "min_age_years": 5, "max_age_years": 18, "default_session_duration_minutes": 30, "default_weekly_frequency": 5, "short_description": "Daily practice on a musical instrument."},
    {"name": "Visual Arts", "slug": "visual-arts", "category": "arts", "color": "#EC4899", "icon": "Palette", "min_age_years": 4, "max_age_years": 18, "default_session_duration_minutes": 45, "default_weekly_frequency": 2, "short_description": "Drawing, painting, sculpture, and art appreciation."},
    {"name": "Drama", "slug": "drama", "category": "arts", "color": "#F43F5E", "icon": "Theater", "min_age_years": 5, "max_age_years": 18, "default_session_duration_minutes": 45, "default_weekly_frequency": 2, "short_description": "Acting, recitation, and dramatic performance."},

    # Physical
    {"name": "Nature Study", "slug": "nature-study", "category": "physical", "color": "#22C55E", "icon": "Leaf", "min_age_years": 4, "max_age_years": 14, "default_session_duration_minutes": 45, "default_weekly_frequency": 3, "short_description": "Outdoor observation, nature journaling, and seasonal study."},
    {"name": "Physical Education", "slug": "physical-education", "category": "physical", "color": "#F97316", "icon": "Dumbbell", "min_age_years": 4, "max_age_years": 18, "default_session_duration_minutes": 45, "default_weekly_frequency": 5, "short_description": "Exercise, sport, and physical fitness."},

    # Logic & Rhetoric
    {"name": "Logic", "slug": "logic", "category": "logic_rhetoric", "color": "#6366F1", "icon": "Brain", "min_age_years": 10, "max_age_years": 18, "default_session_duration_minutes": 40, "default_weekly_frequency": 3, "short_description": "Formal and informal logic, critical thinking, and argument analysis."},
    {"name": "Rhetoric", "slug": "rhetoric", "category": "logic_rhetoric", "color": "#8B5CF6", "icon": "MessageSquare", "min_age_years": 13, "max_age_years": 18, "default_session_duration_minutes": 45, "default_weekly_frequency": 3, "short_description": "Persuasive writing and speech, debate, and oratory."},

    # Technology
    {"name": "Typing", "slug": "typing", "category": "technology", "color": "#64748B", "icon": "Keyboard", "min_age_years": 7, "max_age_years": 14, "default_session_duration_minutes": 15, "default_weekly_frequency": 5, "short_description": "Touch typing skills and keyboard fluency."},
    {"name": "Computer Science", "slug": "computer-science", "category": "technology", "color": "#0EA5E9", "icon": "Monitor", "min_age_years": 10, "max_age_years": 18, "default_session_duration_minutes": 45, "default_weekly_frequency": 3, "short_description": "Programming, algorithms, and computational thinking."},

    # Practical Life
    {"name": "Home Economics", "slug": "home-economics", "category": "practical_life", "color": "#F59E0B", "icon": "Home", "min_age_years": 8, "max_age_years": 18, "default_session_duration_minutes": 45, "default_weekly_frequency": 2, "short_description": "Cooking, sewing, budgeting, and household management."},
    {"name": "Gardening", "slug": "gardening", "category": "practical_life", "color": "#16A34A", "icon": "Sprout", "min_age_years": 5, "max_age_years": 18, "default_session_duration_minutes": 30, "default_weekly_frequency": 3, "short_description": "Growing food, plant care, and seasonal gardening."},
]
