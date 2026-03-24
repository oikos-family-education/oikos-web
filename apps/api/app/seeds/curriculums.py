"""Platform-provided curriculum templates for Oikos."""

from datetime import date

# Map subject slugs to the subjects they include with scheduling
# Each entry: (subject_slug, weekly_frequency, session_duration_minutes, scheduled_days)

EARLY_YEARS_SUBJECTS = [
    ("early-literacy", 5, 20, [0, 1, 2, 3, 4]),
    ("early-numeracy", 5, 20, [0, 1, 2, 3, 4]),
    ("scripture-bible", 5, 15, [0, 1, 2, 3, 4]),
    ("visual-arts", 3, 30, [0, 2, 4]),
    ("nature-study", 3, 30, [1, 3, 4]),
    ("physical-education", 5, 30, [0, 1, 2, 3, 4]),
    ("instrument-practice", 3, 15, [0, 2, 4]),
]

CLASSICAL_GRAMMAR_PRIMARY_SUBJECTS = [
    ("phonics", 5, 20, [0, 1, 2, 3, 4]),
    ("reading", 5, 30, [0, 1, 2, 3, 4]),
    ("handwriting-penmanship", 5, 15, [0, 1, 2, 3, 4]),
    ("mathematics", 5, 40, [0, 1, 2, 3, 4]),
    ("language-arts-english", 5, 30, [0, 1, 2, 3, 4]),
    ("history-geography", 4, 30, [0, 1, 3, 4]),
    ("science", 3, 30, [1, 3, 4]),
    ("scripture-bible", 5, 20, [0, 1, 2, 3, 4]),
    ("latin", 3, 20, [0, 2, 4]),
    ("visual-arts", 2, 40, [1, 3]),
    ("music-theory", 2, 20, [0, 4]),
    ("physical-education", 5, 30, [0, 1, 2, 3, 4]),
    ("nature-study", 2, 30, [2, 4]),
]

CLASSICAL_GRAMMAR_UPPER_SUBJECTS = [
    ("reading", 5, 30, [0, 1, 2, 3, 4]),
    ("mathematics", 5, 45, [0, 1, 2, 3, 4]),
    ("language-arts-english", 5, 40, [0, 1, 2, 3, 4]),
    ("writing-composition", 3, 30, [0, 2, 4]),
    ("history-geography", 4, 40, [0, 1, 3, 4]),
    ("science", 4, 40, [0, 1, 2, 4]),
    ("scripture-bible", 5, 20, [0, 1, 2, 3, 4]),
    ("latin", 4, 30, [0, 1, 3, 4]),
    ("logic", 3, 30, [0, 2, 4]),
    ("visual-arts", 2, 40, [1, 3]),
    ("music-theory", 2, 20, [0, 4]),
    ("physical-education", 5, 30, [0, 1, 2, 3, 4]),
]

CLASSICAL_DIALECTIC_SUBJECTS = [
    ("mathematics", 5, 45, [0, 1, 2, 3, 4]),
    ("language-arts-english", 5, 40, [0, 1, 2, 3, 4]),
    ("writing-composition", 4, 40, [0, 1, 2, 4]),
    ("history-geography", 4, 45, [0, 1, 3, 4]),
    ("science", 4, 45, [0, 1, 2, 4]),
    ("scripture-bible", 5, 20, [0, 1, 2, 3, 4]),
    ("latin", 4, 30, [0, 1, 3, 4]),
    ("logic", 3, 40, [0, 2, 4]),
    ("music-theory", 2, 30, [1, 3]),
    ("physical-education", 5, 30, [0, 1, 2, 3, 4]),
]

CLASSICAL_RHETORIC_SUBJECTS = [
    ("mathematics", 5, 50, [0, 1, 2, 3, 4]),
    ("language-arts-english", 4, 45, [0, 1, 3, 4]),
    ("writing-composition", 4, 45, [0, 1, 2, 4]),
    ("history-geography", 4, 45, [0, 1, 3, 4]),
    ("science", 4, 50, [0, 1, 2, 4]),
    ("scripture-bible", 5, 20, [0, 1, 2, 3, 4]),
    ("church-history", 2, 40, [1, 3]),
    ("latin", 4, 30, [0, 1, 3, 4]),
    ("rhetoric", 3, 45, [0, 2, 4]),
    ("logic", 2, 40, [1, 3]),
    ("physical-education", 3, 30, [0, 2, 4]),
]

CM_EARLY_SUBJECTS = [
    ("reading", 5, 20, [0, 1, 2, 3, 4]),
    ("handwriting-penmanship", 5, 15, [0, 1, 2, 3, 4]),
    ("mathematics", 5, 30, [0, 1, 2, 3, 4]),
    ("scripture-bible", 5, 15, [0, 1, 2, 3, 4]),
    ("nature-study", 3, 45, [1, 3, 4]),
    ("visual-arts", 2, 30, [0, 3]),
    ("instrument-practice", 3, 15, [0, 2, 4]),
    ("physical-education", 5, 30, [0, 1, 2, 3, 4]),
    ("history-geography", 3, 20, [0, 2, 4]),
]

CM_MIDDLE_SUBJECTS = [
    ("reading", 5, 30, [0, 1, 2, 3, 4]),
    ("mathematics", 5, 40, [0, 1, 2, 3, 4]),
    ("language-arts-english", 5, 30, [0, 1, 2, 3, 4]),
    ("writing-composition", 3, 30, [0, 2, 4]),
    ("history-geography", 4, 35, [0, 1, 3, 4]),
    ("science", 3, 35, [1, 3, 4]),
    ("scripture-bible", 5, 20, [0, 1, 2, 3, 4]),
    ("nature-study", 2, 45, [2, 4]),
    ("visual-arts", 2, 40, [1, 3]),
    ("music-theory", 2, 20, [0, 4]),
    ("physical-education", 5, 30, [0, 1, 2, 3, 4]),
]

STRUCTURED_ELEMENTARY_SUBJECTS = [
    ("reading", 5, 30, [0, 1, 2, 3, 4]),
    ("handwriting-penmanship", 5, 15, [0, 1, 2, 3, 4]),
    ("mathematics", 5, 40, [0, 1, 2, 3, 4]),
    ("language-arts-english", 5, 30, [0, 1, 2, 3, 4]),
    ("history-geography", 3, 30, [0, 2, 4]),
    ("science", 3, 30, [1, 3, 4]),
    ("scripture-bible", 5, 15, [0, 1, 2, 3, 4]),
    ("physical-education", 5, 30, [0, 1, 2, 3, 4]),
    ("visual-arts", 1, 40, [3]),
]

STRUCTURED_MIDDLE_SUBJECTS = [
    ("mathematics", 5, 45, [0, 1, 2, 3, 4]),
    ("language-arts-english", 5, 40, [0, 1, 2, 3, 4]),
    ("writing-composition", 3, 35, [0, 2, 4]),
    ("history-geography", 4, 40, [0, 1, 3, 4]),
    ("science", 4, 40, [0, 1, 2, 4]),
    ("scripture-bible", 5, 15, [0, 1, 2, 3, 4]),
    ("spanish", 3, 30, [0, 2, 4]),
    ("physical-education", 3, 30, [1, 3, 4]),
    ("typing", 3, 15, [0, 2, 4]),
]

ECLECTIC_HIGH_SCHOOL_SUBJECTS = [
    ("mathematics", 5, 50, [0, 1, 2, 3, 4]),
    ("language-arts-english", 4, 45, [0, 1, 3, 4]),
    ("writing-composition", 3, 45, [0, 2, 4]),
    ("history-geography", 4, 45, [0, 1, 3, 4]),
    ("science", 4, 50, [0, 1, 2, 4]),
    ("scripture-bible", 5, 20, [0, 1, 2, 3, 4]),
    ("logic", 2, 40, [1, 3]),
    ("spanish", 4, 30, [0, 1, 3, 4]),
    ("computer-science", 2, 45, [2, 4]),
    ("physical-education", 3, 30, [0, 2, 4]),
]


PLATFORM_CURRICULUM_TEMPLATES = [
    {
        "name": "Early Years Foundation",
        "description": "A gentle, play-based curriculum for ages 3-5 focusing on early literacy, numeracy, and outdoor exploration.",
        "education_philosophy": "Relaxed / Play-based",
        "period_type": "annual",
        "start_date": date(2025, 9, 1),
        "end_date": date(2026, 6, 15),
        "academic_year": "2025-2026",
        "subjects": EARLY_YEARS_SUBJECTS,
    },
    {
        "name": "Classical Grammar Stage \u2013 Primary",
        "description": "A classical curriculum for ages 6-9 building strong foundations in language, maths, and memory work.",
        "education_philosophy": "Classical",
        "period_type": "annual",
        "start_date": date(2025, 9, 1),
        "end_date": date(2026, 6, 15),
        "academic_year": "2025-2026",
        "subjects": CLASSICAL_GRAMMAR_PRIMARY_SUBJECTS,
    },
    {
        "name": "Classical Grammar Stage \u2013 Upper",
        "description": "Advanced grammar-stage work for ages 10-12 with introduction to logic and deeper subject study.",
        "education_philosophy": "Classical",
        "period_type": "annual",
        "start_date": date(2025, 9, 1),
        "end_date": date(2026, 6, 15),
        "academic_year": "2025-2026",
        "subjects": CLASSICAL_GRAMMAR_UPPER_SUBJECTS,
    },
    {
        "name": "Classical Dialectic Stage",
        "description": "The logic stage for ages 10-12 emphasising reasoning, debate, and analytical thinking.",
        "education_philosophy": "Classical",
        "period_type": "annual",
        "start_date": date(2025, 9, 1),
        "end_date": date(2026, 6, 15),
        "academic_year": "2025-2026",
        "subjects": CLASSICAL_DIALECTIC_SUBJECTS,
    },
    {
        "name": "Classical Rhetoric Stage",
        "description": "The rhetoric stage for ages 13-15 focusing on eloquent expression, persuasion, and synthesis.",
        "education_philosophy": "Classical",
        "period_type": "annual",
        "start_date": date(2025, 9, 1),
        "end_date": date(2026, 6, 15),
        "academic_year": "2025-2026",
        "subjects": CLASSICAL_RHETORIC_SUBJECTS,
    },
    {
        "name": "Charlotte Mason \u2013 Early Years",
        "description": "A Charlotte Mason approach for ages 5-8 with short lessons, living books, and nature study.",
        "education_philosophy": "Charlotte Mason",
        "period_type": "annual",
        "start_date": date(2025, 9, 1),
        "end_date": date(2026, 6, 15),
        "academic_year": "2025-2026",
        "subjects": CM_EARLY_SUBJECTS,
    },
    {
        "name": "Charlotte Mason \u2013 Middle Years",
        "description": "Charlotte Mason method for ages 9-12 with varied subjects, narration, and nature journals.",
        "education_philosophy": "Charlotte Mason",
        "period_type": "annual",
        "start_date": date(2025, 9, 1),
        "end_date": date(2026, 6, 15),
        "academic_year": "2025-2026",
        "subjects": CM_MIDDLE_SUBJECTS,
    },
    {
        "name": "Structured Core \u2013 Elementary",
        "description": "A structured, textbook-based curriculum for ages 6-10 with clear daily schedules.",
        "education_philosophy": "Structured",
        "period_type": "annual",
        "start_date": date(2025, 9, 1),
        "end_date": date(2026, 6, 15),
        "academic_year": "2025-2026",
        "subjects": STRUCTURED_ELEMENTARY_SUBJECTS,
    },
    {
        "name": "Structured Core \u2013 Middle School",
        "description": "Structured middle-school curriculum for ages 11-13 preparing for high school rigour.",
        "education_philosophy": "Structured",
        "period_type": "annual",
        "start_date": date(2025, 9, 1),
        "end_date": date(2026, 6, 15),
        "academic_year": "2025-2026",
        "subjects": STRUCTURED_MIDDLE_SUBJECTS,
    },
    {
        "name": "Eclectic \u2013 High School Prep",
        "description": "An eclectic high-school prep curriculum for ages 13-16 blending methods and subjects.",
        "education_philosophy": "Eclectic",
        "period_type": "annual",
        "start_date": date(2025, 9, 1),
        "end_date": date(2026, 6, 15),
        "academic_year": "2025-2026",
        "subjects": ECLECTIC_HIGH_SCHOOL_SUBJECTS,
    },
]
