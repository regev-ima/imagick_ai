/**
 * Gallery-type-specific culling labels in 15 languages.
 * Each gallery type has 12 carefully chosen labels that represent
 * the most important image categories for that type of shoot.
 */

export type LanguageCode =
  | "en" | "zh" | "hi" | "es" | "fr" | "ar" | "bn"
  | "pt" | "ru" | "ja" | "de" | "ko" | "tr" | "it" | "he";

export interface LanguageOption {
  code: LanguageCode;
  name: string;        // Native name
  englishName: string; // English name for reference
}

export const supportedLanguages: LanguageOption[] = [
  { code: "en", name: "English",    englishName: "English" },
  { code: "zh", name: "中文",       englishName: "Chinese" },
  { code: "hi", name: "हिन्दी",      englishName: "Hindi" },
  { code: "es", name: "Español",    englishName: "Spanish" },
  { code: "fr", name: "Français",   englishName: "French" },
  { code: "ar", name: "العربية",    englishName: "Arabic" },
  { code: "bn", name: "বাংলা",      englishName: "Bengali" },
  { code: "pt", name: "Português",  englishName: "Portuguese" },
  { code: "ru", name: "Русский",    englishName: "Russian" },
  { code: "ja", name: "日本語",     englishName: "Japanese" },
  { code: "de", name: "Deutsch",    englishName: "German" },
  { code: "ko", name: "한국어",     englishName: "Korean" },
  { code: "tr", name: "Türkçe",     englishName: "Turkish" },
  { code: "it", name: "Italiano",   englishName: "Italian" },
  { code: "he", name: "עברית",      englishName: "Hebrew" },
];

// English labels per gallery type (source of truth)
const labelsEN: Record<string, string[]> = {
  wedding: [
    "Ceremony", "Reception", "Getting Ready", "First Dance",
    "Couple Portrait", "Family Group", "Bridal Party", "Rings & Details",
    "Cake Cutting", "Venue", "Candid Moments", "Exit & Send-off"
  ],
  portrait: [
    "Headshot", "Full Body", "Close-up", "Profile",
    "Environmental", "Studio", "Natural Light", "Black & White",
    "Expression", "Posed", "Candid", "Creative"
  ],
  newborn: [
    "Baby Solo", "With Parents", "With Siblings", "Close-up Details",
    "Sleeping", "Wrapped", "Prop Setup", "Natural Pose",
    "Hands & Feet", "Family Together", "Studio Setup", "Lifestyle"
  ],
  family: [
    "Group Portrait", "Candid Play", "Individual Portrait", "Couple Shot",
    "Kids Together", "Outdoor", "Indoor", "Generational",
    "Walking & Movement", "Hugging", "Laughing", "Detail Shots"
  ],
  event: [
    "Stage & Performance", "Crowd & Audience", "Speakers", "Networking",
    "Decor & Setup", "Food & Drinks", "Award Ceremony", "Group Photo",
    "Candid Moments", "Branding & Signage", "Behind the Scenes", "VIP & Guests"
  ],
  commercial: [
    "Product Shot", "Lifestyle", "Flat Lay", "Model with Product",
    "Interior Space", "Detail & Texture", "Branding", "Packaging",
    "Before & After", "Team & People", "Behind the Scenes", "Hero Shot"
  ],
  real_estate: [
    "Exterior Front", "Living Room", "Kitchen", "Bedroom",
    "Bathroom", "Dining Area", "Backyard & Garden", "Aerial & Drone",
    "Detail Shots", "Neighborhood", "Floor Plan View", "Twilight & Dusk"
  ],
  fashion: [
    "Runway", "Editorial", "Lookbook", "Close-up Detail",
    "Full Outfit", "Accessory", "Behind the Scenes", "Beauty & Makeup",
    "Street Style", "Studio", "Location", "Campaign"
  ],
  food: [
    "Plated Dish", "Ingredients", "Preparation", "Overhead & Flat Lay",
    "Side Angle", "Close-up Texture", "Table Setting", "Restaurant Interior",
    "Chef & Staff", "Drinks & Beverages", "Dessert", "Action Shot"
  ],
  landscape: [
    "Wide Vista", "Golden Hour", "Blue Hour", "Foreground Interest",
    "Aerial & Drone", "Water & Reflection", "Mountain", "Forest & Trees",
    "Urban Skyline", "Night & Stars", "Weather & Storm", "Panoramic"
  ],
  street: [
    "Candid People", "Architecture", "Reflections", "Shadows & Light",
    "Motion Blur", "Night Scene", "Urban Detail", "Street Art",
    "Documentary", "Silhouette", "Layers & Depth", "Decisive Moment"
  ],
  sports: [
    "Action Shot", "Celebration", "Team Photo", "Individual Athlete",
    "Wide Angle Venue", "Close-up Emotion", "Pre-game & Warmup", "Fans & Crowd",
    "Trophy & Award", "Behind the Scenes", "Aerial View", "Equipment Detail"
  ],
};

// Translations for each gallery type
const translations: Record<LanguageCode, Record<string, string[]>> = {
  en: labelsEN,

  he: {
    wedding: [
      "טקס", "קבלת פנים", "הכנות", "ריקוד ראשון",
      "פורטרט זוגי", "תמונה משפחתית", "שושבינות", "טבעות ופרטים",
      "חיתוך עוגה", "מקום האירוע", "רגעים ספונטניים", "יציאה ופרידה"
    ],
    portrait: [
      "תקריב פנים", "גוף מלא", "קלוז-אפ", "פרופיל",
      "סביבתי", "סטודיו", "אור טבעי", "שחור-לבן",
      "הבעה", "מונחה", "ספונטני", "יצירתי"
    ],
    newborn: [
      "תינוק בודד", "עם הורים", "עם אחים", "פרטים מקרוב",
      "ישן", "עטוף", "עם אביזרים", "תנוחה טבעית",
      "ידיים ורגליים", "משפחה ביחד", "סטודיו", "לייפסטייל"
    ],
    family: [
      "פורטרט קבוצתי", "משחק ספונטני", "פורטרט אישי", "זוגי",
      "ילדים ביחד", "חיצוני", "פנימי", "דורות",
      "הליכה ותנועה", "חיבוק", "צחוק", "פרטים"
    ],
    event: [
      "במה והופעה", "קהל", "דוברים", "נטוורקינג",
      "עיצוב ותפאורה", "אוכל ושתייה", "טקס פרסים", "תמונה קבוצתית",
      "רגעים ספונטניים", "מיתוג ושילוט", "מאחורי הקלעים", "אורחי VIP"
    ],
    commercial: [
      "צילום מוצר", "לייפסטייל", "שטוח", "דוגמן עם מוצר",
      "חלל פנימי", "פרטים ומרקם", "מיתוג", "אריזה",
      "לפני ואחרי", "צוות ואנשים", "מאחורי הקלעים", "תמונת גיבור"
    ],
    real_estate: [
      "חזית חיצונית", "סלון", "מטבח", "חדר שינה",
      "חדר אמבטיה", "פינת אוכל", "חצר וגינה", "צילום אווירי",
      "פרטים", "שכונה", "תוכנית קומה", "שעת דמדומים"
    ],
    fashion: [
      "מסלול", "אדיטוריאל", "לוקבוק", "פרט מקרוב",
      "תלבושת מלאה", "אקססורי", "מאחורי הקלעים", "יופי ואיפור",
      "סטייל רחוב", "סטודיו", "לוקיישן", "קמפיין"
    ],
    food: [
      "מנה מוגשת", "מרכיבים", "הכנה", "מלמעלה",
      "זווית צד", "טקסטורה מקרוב", "עריכת שולחן", "פנים המסעדה",
      "שף וצוות", "שתייה ומשקאות", "קינוח", "צילום פעולה"
    ],
    landscape: [
      "נוף רחב", "שעת הזהב", "שעה כחולה", "עניין בקדמת התמונה",
      "צילום אווירי", "מים והשתקפות", "הר", "יער ועצים",
      "קו רקיע עירוני", "לילה וכוכבים", "מזג אוויר וסערה", "פנורמי"
    ],
    street: [
      "אנשים ספונטניים", "אדריכלות", "השתקפויות", "צללים ואור",
      "טשטוש תנועה", "סצנת לילה", "פרט עירוני", "אמנות רחוב",
      "דוקומנטרי", "צללית", "שכבות ועומק", "הרגע המכריע"
    ],
    sports: [
      "צילום פעולה", "חגיגה", "תמונת קבוצה", "ספורטאי בודד",
      "זווית רחבה של המגרש", "רגש מקרוב", "חימום", "אוהדים וקהל",
      "גביע ופרס", "מאחורי הקלעים", "מבט אווירי", "ציוד ופרטים"
    ],
  },

  zh: {
    wedding: [
      "仪式", "宴会", "准备", "第一支舞",
      "新人合影", "家族合影", "伴娘伴郎", "戒指与细节",
      "切蛋糕", "场地", "抓拍瞬间", "退场与送别"
    ],
    portrait: [
      "头像", "全身", "特写", "侧面",
      "环境人像", "棚拍", "自然光", "黑白",
      "表情", "摆拍", "抓拍", "创意"
    ],
    newborn: [
      "宝宝独照", "与父母", "与兄弟姐妹", "细节特写",
      "睡眠", "包裹", "道具布置", "自然姿势",
      "手脚", "全家福", "棚拍", "生活风"
    ],
    family: [
      "全家福", "自然玩耍", "个人肖像", "夫妻合照",
      "孩子合照", "户外", "室内", "多代同堂",
      "行走与运动", "拥抱", "欢笑", "细节"
    ],
    event: [
      "舞台表演", "观众", "演讲者", "社交",
      "布置与装饰", "餐饮", "颁奖典礼", "合影",
      "抓拍", "品牌标识", "幕后", "贵宾"
    ],
    commercial: [
      "产品照", "生活方式", "平拍", "模特与产品",
      "室内空间", "细节与质感", "品牌", "包装",
      "前后对比", "团队", "幕后", "主图"
    ],
    real_estate: [
      "外观正面", "客厅", "厨房", "卧室",
      "浴室", "餐厅", "庭院花园", "航拍",
      "细节", "周边环境", "平面图", "黄昏"
    ],
    fashion: [
      "走秀", "大片", "型录", "细节特写",
      "全身穿搭", "配饰", "幕后", "美妆",
      "街拍", "棚拍", "外景", "广告"
    ],
    food: [
      "成品菜肴", "食材", "制作过程", "俯拍",
      "侧面", "质感特写", "餐桌布置", "餐厅内部",
      "厨师与团队", "饮品", "甜点", "动态拍摄"
    ],
    landscape: [
      "广角全景", "金色时刻", "蓝色时刻", "前景趣味",
      "航拍", "水面倒影", "山景", "森林",
      "城市天际线", "星空", "风暴天气", "全景"
    ],
    street: [
      "街头人物", "建筑", "倒影", "光影",
      "运动模糊", "夜景", "城市细节", "街头艺术",
      "纪实", "剪影", "层次与纵深", "决定性瞬间"
    ],
    sports: [
      "动作瞬间", "庆祝", "团队合影", "运动员个人",
      "场馆全景", "情绪特写", "赛前热身", "球迷",
      "奖杯", "幕后", "航拍", "器材细节"
    ],
  },

  hi: {
    wedding: [
      "विवाह संस्कार", "रिसेप्शन", "तैयारी", "पहला डांस",
      "जोड़े का पोर्ट्रेट", "पारिवारिक समूह", "बारात", "अंगूठी और विवरण",
      "केक कटिंग", "स्थल", "स्वाभाविक क्षण", "विदाई"
    ],
    portrait: [
      "हेडशॉट", "पूरा शरीर", "क्लोज़-अप", "प्रोफ़ाइल",
      "पर्यावरणीय", "स्टूडियो", "प्राकृतिक प्रकाश", "ब्लैक एंड व्हाइट",
      "अभिव्यक्ति", "पोज़्ड", "कैंडिड", "रचनात्मक"
    ],
    newborn: [
      "शिशु अकेला", "माता-पिता के साथ", "भाई-बहन के साथ", "क्लोज़-अप विवरण",
      "सोते हुए", "लिपटा हुआ", "प्रॉप सेटअप", "स्वाभाविक मुद्रा",
      "हाथ और पैर", "परिवार साथ में", "स्टूडियो", "लाइफ़स्टाइल"
    ],
    family: [
      "समूह पोर्ट्रेट", "खेलते हुए", "व्यक्तिगत पोर्ट्रेट", "जोड़े की फ़ोटो",
      "बच्चे साथ में", "आउटडोर", "इनडोर", "पीढ़ियाँ",
      "चलते-फिरते", "गले लगाते", "हँसते हुए", "विवरण"
    ],
    event: [
      "मंच और प्रदर्शन", "दर्शक", "वक्ता", "नेटवर्किंग",
      "सजावट", "खाना-पीना", "पुरस्कार समारोह", "समूह फ़ोटो",
      "कैंडिड", "ब्रांडिंग", "पर्दे के पीछे", "VIP अतिथि"
    ],
    commercial: [
      "उत्पाद शॉट", "लाइफ़स्टाइल", "फ़्लैट ले", "मॉडल के साथ",
      "आंतरिक स्थान", "विवरण और बनावट", "ब्रांडिंग", "पैकेजिंग",
      "पहले और बाद", "टीम", "पर्दे के पीछे", "हीरो शॉट"
    ],
    real_estate: [
      "बाहरी मुखौटा", "लिविंग रूम", "किचन", "बेडरूम",
      "बाथरूम", "डाइनिंग एरिया", "बगीचा", "एरियल",
      "विवरण", "पड़ोस", "फ़्लोर प्लान", "गोधूलि"
    ],
    fashion: [
      "रनवे", "एडिटोरियल", "लुकबुक", "क्लोज़-अप विवरण",
      "पूरी पोशाक", "एक्सेसरी", "पर्दे के पीछे", "ब्यूटी और मेकअप",
      "स्ट्रीट स्टाइल", "स्टूडियो", "लोकेशन", "कैम्पेन"
    ],
    food: [
      "परोसा गया व्यंजन", "सामग्री", "तैयारी", "ऊपर से",
      "साइड एंगल", "बनावट क्लोज़-अप", "टेबल सेटिंग", "रेस्तरां इंटीरियर",
      "शेफ़ और स्टाफ़", "पेय पदार्थ", "मिठाई", "एक्शन शॉट"
    ],
    landscape: [
      "विस्तृत दृश्य", "गोल्डन ऑवर", "ब्लू ऑवर", "अग्रभूमि",
      "एरियल", "पानी और प्रतिबिंब", "पहाड़", "जंगल और पेड़",
      "शहरी स्काईलाइन", "रात और तारे", "तूफ़ान", "पैनोरमिक"
    ],
    street: [
      "राहगीर", "वास्तुकला", "प्रतिबिंब", "छाया और प्रकाश",
      "मोशन ब्लर", "रात का दृश्य", "शहरी विवरण", "स्ट्रीट आर्ट",
      "डॉक्यूमेंट्री", "सिल्हूट", "परतें और गहराई", "निर्णायक क्षण"
    ],
    sports: [
      "एक्शन शॉट", "जश्न", "टीम फ़ोटो", "व्यक्तिगत एथलीट",
      "वाइड एंगल", "भावना क्लोज़-अप", "वार्म-अप", "प्रशंसक",
      "ट्रॉफ़ी", "पर्दे के पीछे", "एरियल", "उपकरण विवरण"
    ],
  },

  es: {
    wedding: [
      "Ceremonia", "Recepción", "Preparativos", "Primer baile",
      "Retrato de pareja", "Foto familiar", "Cortejo nupcial", "Anillos y detalles",
      "Corte de pastel", "Lugar", "Momentos espontáneos", "Salida y despedida"
    ],
    portrait: [
      "Primer plano", "Cuerpo entero", "Detalle", "Perfil",
      "Ambiental", "Estudio", "Luz natural", "Blanco y negro",
      "Expresión", "Posado", "Espontáneo", "Creativo"
    ],
    newborn: [
      "Bebé solo", "Con padres", "Con hermanos", "Detalles",
      "Durmiendo", "Envuelto", "Con accesorios", "Pose natural",
      "Manos y pies", "Familia junta", "Estudio", "Estilo de vida"
    ],
    family: [
      "Retrato grupal", "Juego espontáneo", "Retrato individual", "Foto de pareja",
      "Niños juntos", "Exterior", "Interior", "Generacional",
      "Caminando", "Abrazos", "Risas", "Detalles"
    ],
    event: [
      "Escenario", "Público", "Ponentes", "Networking",
      "Decoración", "Comida y bebida", "Premiación", "Foto grupal",
      "Momentos espontáneos", "Señalización", "Tras bastidores", "VIP e invitados"
    ],
    commercial: [
      "Foto de producto", "Estilo de vida", "Flat lay", "Modelo con producto",
      "Espacio interior", "Detalle y textura", "Marca", "Empaque",
      "Antes y después", "Equipo", "Tras bastidores", "Foto principal"
    ],
    real_estate: [
      "Exterior frontal", "Sala", "Cocina", "Dormitorio",
      "Baño", "Comedor", "Jardín", "Aérea",
      "Detalles", "Vecindario", "Plano", "Crepúsculo"
    ],
    fashion: [
      "Pasarela", "Editorial", "Lookbook", "Detalle",
      "Outfit completo", "Accesorio", "Tras bastidores", "Belleza y maquillaje",
      "Street style", "Estudio", "Locación", "Campaña"
    ],
    food: [
      "Plato", "Ingredientes", "Preparación", "Cenital",
      "Ángulo lateral", "Textura", "Mesa puesta", "Interior restaurante",
      "Chef y equipo", "Bebidas", "Postre", "Acción"
    ],
    landscape: [
      "Vista amplia", "Hora dorada", "Hora azul", "Primer plano",
      "Aérea", "Agua y reflejos", "Montaña", "Bosque",
      "Horizonte urbano", "Noche y estrellas", "Tormenta", "Panorámica"
    ],
    street: [
      "Personas espontáneas", "Arquitectura", "Reflejos", "Sombras y luz",
      "Barrido", "Escena nocturna", "Detalle urbano", "Arte callejero",
      "Documental", "Silueta", "Capas y profundidad", "Momento decisivo"
    ],
    sports: [
      "Acción", "Celebración", "Foto de equipo", "Atleta individual",
      "Gran angular", "Emoción", "Calentamiento", "Aficionados",
      "Trofeo", "Tras bastidores", "Vista aérea", "Equipamiento"
    ],
  },

  fr: {
    wedding: [
      "Cérémonie", "Réception", "Préparatifs", "Première danse",
      "Portrait de couple", "Photo de famille", "Cortège", "Alliances et détails",
      "Découpe du gâteau", "Lieu", "Moments spontanés", "Sortie et au revoir"
    ],
    portrait: [
      "Portrait serré", "Corps entier", "Gros plan", "Profil",
      "Environnemental", "Studio", "Lumière naturelle", "Noir et blanc",
      "Expression", "Posé", "Spontané", "Créatif"
    ],
    newborn: [
      "Bébé seul", "Avec les parents", "Avec frères et sœurs", "Détails",
      "Endormi", "Emmailloté", "Mise en scène", "Pose naturelle",
      "Mains et pieds", "Famille ensemble", "Studio", "Lifestyle"
    ],
    family: [
      "Portrait de groupe", "Jeu spontané", "Portrait individuel", "Photo de couple",
      "Enfants ensemble", "Extérieur", "Intérieur", "Générationnel",
      "En marchant", "Câlins", "Rires", "Détails"
    ],
    event: [
      "Scène", "Public", "Intervenants", "Networking",
      "Décoration", "Nourriture et boissons", "Remise de prix", "Photo de groupe",
      "Moments spontanés", "Signalétique", "Coulisses", "VIP et invités"
    ],
    commercial: [
      "Photo produit", "Lifestyle", "Flat lay", "Modèle avec produit",
      "Espace intérieur", "Détail et texture", "Branding", "Emballage",
      "Avant et après", "Équipe", "Coulisses", "Photo phare"
    ],
    real_estate: [
      "Façade extérieure", "Salon", "Cuisine", "Chambre",
      "Salle de bain", "Salle à manger", "Jardin", "Vue aérienne",
      "Détails", "Quartier", "Plan d'étage", "Crépuscule"
    ],
    fashion: [
      "Défilé", "Éditorial", "Lookbook", "Détail gros plan",
      "Tenue complète", "Accessoire", "Coulisses", "Beauté et maquillage",
      "Street style", "Studio", "En extérieur", "Campagne"
    ],
    food: [
      "Plat dressé", "Ingrédients", "Préparation", "Vue du dessus",
      "Angle latéral", "Texture gros plan", "Table dressée", "Intérieur restaurant",
      "Chef et équipe", "Boissons", "Dessert", "Action"
    ],
    landscape: [
      "Vue panoramique", "Heure dorée", "Heure bleue", "Premier plan",
      "Vue aérienne", "Eau et reflets", "Montagne", "Forêt",
      "Skyline urbain", "Nuit et étoiles", "Orage", "Panoramique"
    ],
    street: [
      "Passants", "Architecture", "Reflets", "Ombres et lumière",
      "Flou de mouvement", "Scène de nuit", "Détail urbain", "Art de rue",
      "Documentaire", "Silhouette", "Plans et profondeur", "Instant décisif"
    ],
    sports: [
      "Action", "Célébration", "Photo d'équipe", "Athlète",
      "Grand angle", "Émotion", "Échauffement", "Supporters",
      "Trophée", "Coulisses", "Vue aérienne", "Équipement"
    ],
  },

  ar: {
    wedding: [
      "حفل الزفاف", "حفل الاستقبال", "التحضيرات", "الرقصة الأولى",
      "صورة الزوجين", "صورة العائلة", "وصيفات العروس", "الخواتم والتفاصيل",
      "قطع الكعكة", "المكان", "لحظات عفوية", "الخروج والوداع"
    ],
    portrait: [
      "صورة الرأس", "الجسم الكامل", "لقطة قريبة", "بروفايل",
      "بيئي", "استوديو", "إضاءة طبيعية", "أبيض وأسود",
      "تعبير", "بوز", "عفوي", "إبداعي"
    ],
    newborn: [
      "المولود وحده", "مع الوالدين", "مع الأشقاء", "تفاصيل قريبة",
      "نائم", "ملفوف", "إكسسوارات", "وضعية طبيعية",
      "الأيدي والأقدام", "العائلة معاً", "استوديو", "لايفستايل"
    ],
    family: [
      "صورة جماعية", "لعب عفوي", "صورة فردية", "صورة زوجية",
      "الأطفال معاً", "خارجي", "داخلي", "أجيال",
      "المشي والحركة", "العناق", "الضحك", "التفاصيل"
    ],
    event: [
      "المسرح والأداء", "الجمهور", "المتحدثون", "التواصل",
      "الديكور", "الطعام والشراب", "حفل الجوائز", "صورة جماعية",
      "لحظات عفوية", "العلامات التجارية", "خلف الكواليس", "ضيوف VIP"
    ],
    commercial: [
      "صورة المنتج", "لايفستايل", "فلات لاي", "عارض مع المنتج",
      "مساحة داخلية", "تفاصيل وملمس", "العلامة التجارية", "التغليف",
      "قبل وبعد", "الفريق", "خلف الكواليس", "الصورة الرئيسية"
    ],
    real_estate: [
      "الواجهة الخارجية", "غرفة المعيشة", "المطبخ", "غرفة النوم",
      "الحمام", "غرفة الطعام", "الحديقة", "تصوير جوي",
      "التفاصيل", "الحي", "مخطط الطابق", "الشفق"
    ],
    fashion: [
      "عرض أزياء", "افتتاحية", "لوكبوك", "تفاصيل قريبة",
      "الزي الكامل", "إكسسوار", "خلف الكواليس", "جمال ومكياج",
      "ستريت ستايل", "استوديو", "موقع تصوير", "حملة إعلانية"
    ],
    food: [
      "الطبق المقدم", "المكونات", "التحضير", "من الأعلى",
      "زاوية جانبية", "ملمس قريب", "إعداد الطاولة", "داخل المطعم",
      "الشيف والطاقم", "المشروبات", "الحلوى", "لقطة حركة"
    ],
    landscape: [
      "منظر واسع", "الساعة الذهبية", "الساعة الزرقاء", "المقدمة",
      "تصوير جوي", "الماء والانعكاس", "الجبل", "الغابة",
      "أفق المدينة", "الليل والنجوم", "العاصفة", "بانوراما"
    ],
    street: [
      "أشخاص عفوي", "العمارة", "الانعكاسات", "الظل والنور",
      "ضبابية الحركة", "مشهد ليلي", "تفاصيل حضرية", "فن الشارع",
      "وثائقي", "ظل", "طبقات وعمق", "اللحظة الحاسمة"
    ],
    sports: [
      "لقطة حركة", "احتفال", "صورة الفريق", "رياضي فردي",
      "زاوية واسعة", "عاطفة قريبة", "الإحماء", "الجمهور",
      "الكأس", "خلف الكواليس", "منظر جوي", "تفاصيل المعدات"
    ],
  },

  bn: {
    wedding: [
      "অনুষ্ঠান", "অভ্যর্থনা", "প্রস্তুতি", "প্রথম নাচ",
      "দম্পতি প্রতিকৃতি", "পারিবারিক ছবি", "বরযাত্রী", "আংটি ও বিবরণ",
      "কেক কাটা", "স্থান", "স্বতঃস্ফূর্ত মুহূর্ত", "বিদায়"
    ],
    portrait: [
      "হেডশট", "পূর্ণ দেহ", "ক্লোজ-আপ", "প্রোফাইল",
      "পরিবেশগত", "স্টুডিও", "প্রাকৃতিক আলো", "সাদা-কালো",
      "অভিব্যক্তি", "পোজড", "ক্যান্ডিড", "সৃজনশীল"
    ],
    newborn: [
      "শিশু একা", "বাবা-মায়ের সাথে", "ভাইবোনের সাথে", "বিস্তারিত ক্লোজ-আপ",
      "ঘুমন্ত", "মোড়ানো", "প্রপ সেটআপ", "স্বাভাবিক ভঙ্গি",
      "হাত ও পা", "পরিবার একসাথে", "স্টুডিও", "লাইফস্টাইল"
    ],
    family: [
      "গ্রুপ প্রতিকৃতি", "খেলাধুলা", "ব্যক্তিগত প্রতিকৃতি", "দম্পতি",
      "বাচ্চারা একসাথে", "বাইরে", "ভিতরে", "প্রজন্ম",
      "হাঁটা ও চলাচল", "আলিঙ্গন", "হাসি", "বিবরণ"
    ],
    event: [
      "মঞ্চ ও পরিবেশনা", "দর্শক", "বক্তা", "নেটওয়ার্কিং",
      "সাজসজ্জা", "খাবার ও পানীয়", "পুরস্কার অনুষ্ঠান", "গ্রুপ ফটো",
      "স্বতঃস্ফূর্ত", "ব্র্যান্ডিং", "পর্দার আড়ালে", "VIP অতিথি"
    ],
    commercial: [
      "পণ্য শট", "লাইফস্টাইল", "ফ্ল্যাট লে", "মডেলের সাথে",
      "অভ্যন্তরীণ", "বিবরণ ও টেক্সচার", "ব্র্যান্ডিং", "প্যাকেজিং",
      "আগে ও পরে", "দল", "পর্দার আড়ালে", "হিরো শট"
    ],
    real_estate: [
      "বাহ্যিক সম্মুখ", "লিভিং রুম", "রান্নাঘর", "শোবার ঘর",
      "বাথরুম", "ডাইনিং", "বাগান", "এরিয়াল",
      "বিবরণ", "পাড়া", "ফ্লোর প্ল্যান", "সন্ধ্যা"
    ],
    fashion: [
      "রানওয়ে", "এডিটোরিয়াল", "লুকবুক", "ক্লোজ-আপ বিবরণ",
      "সম্পূর্ণ পোশাক", "অ্যাক্সেসরি", "পর্দার আড়ালে", "সৌন্দর্য ও মেকআপ",
      "স্ট্রিট স্টাইল", "স্টুডিও", "লোকেশন", "ক্যাম্পেইন"
    ],
    food: [
      "পরিবেশিত খাবার", "উপকরণ", "প্রস্তুতি", "উপর থেকে",
      "পাশের কোণ", "টেক্সচার ক্লোজ-আপ", "টেবিল সেটিং", "রেস্তোরাঁ ইন্টেরিয়র",
      "শেফ ও স্টাফ", "পানীয়", "ডেজার্ট", "অ্যাকশন শট"
    ],
    landscape: [
      "বিস্তৃত দৃশ্য", "গোল্ডেন আওয়ার", "ব্লু আওয়ার", "অগ্রভূমি",
      "এরিয়াল", "জল ও প্রতিফলন", "পাহাড়", "বন ও গাছ",
      "শহুরে স্কাইলাইন", "রাত ও তারা", "ঝড়", "প্যানোরামিক"
    ],
    street: [
      "রাস্তার মানুষ", "স্থাপত্য", "প্রতিফলন", "ছায়া ও আলো",
      "মোশন ব্লার", "রাতের দৃশ্য", "শহুরে বিবরণ", "স্ট্রিট আর্ট",
      "তথ্যচিত্র", "সিলুয়েট", "স্তর ও গভীরতা", "নির্ণায়ক মুহূর্ত"
    ],
    sports: [
      "অ্যাকশন শট", "উদযাপন", "দলের ছবি", "ব্যক্তি ক্রীড়াবিদ",
      "ওয়াইড অ্যাঙ্গেল", "আবেগ ক্লোজ-আপ", "ওয়ার্ম-আপ", "ভক্ত ও দর্শক",
      "ট্রফি", "পর্দার আড়ালে", "এরিয়াল ভিউ", "সরঞ্জাম বিবরণ"
    ],
  },

  pt: {
    wedding: [
      "Cerimônia", "Recepção", "Preparativos", "Primeira dança",
      "Retrato do casal", "Foto de família", "Cortejo", "Alianças e detalhes",
      "Corte do bolo", "Local", "Momentos espontâneos", "Saída e despedida"
    ],
    portrait: [
      "Retrato close", "Corpo inteiro", "Close-up", "Perfil",
      "Ambiental", "Estúdio", "Luz natural", "Preto e branco",
      "Expressão", "Posado", "Espontâneo", "Criativo"
    ],
    newborn: [
      "Bebê sozinho", "Com os pais", "Com irmãos", "Detalhes",
      "Dormindo", "Enrolado", "Com acessórios", "Pose natural",
      "Mãos e pés", "Família junta", "Estúdio", "Lifestyle"
    ],
    family: [
      "Retrato em grupo", "Brincadeira", "Retrato individual", "Foto do casal",
      "Crianças juntas", "Externo", "Interno", "Geracional",
      "Caminhando", "Abraços", "Risadas", "Detalhes"
    ],
    event: [
      "Palco", "Público", "Palestrantes", "Networking",
      "Decoração", "Comida e bebida", "Premiação", "Foto em grupo",
      "Momentos espontâneos", "Sinalização", "Bastidores", "VIP e convidados"
    ],
    commercial: [
      "Foto de produto", "Lifestyle", "Flat lay", "Modelo com produto",
      "Espaço interior", "Detalhe e textura", "Marca", "Embalagem",
      "Antes e depois", "Equipe", "Bastidores", "Foto destaque"
    ],
    real_estate: [
      "Fachada", "Sala de estar", "Cozinha", "Quarto",
      "Banheiro", "Sala de jantar", "Jardim", "Aérea",
      "Detalhes", "Vizinhança", "Planta baixa", "Crepúsculo"
    ],
    fashion: [
      "Passarela", "Editorial", "Lookbook", "Detalhe",
      "Look completo", "Acessório", "Bastidores", "Beleza e maquiagem",
      "Street style", "Estúdio", "Locação", "Campanha"
    ],
    food: [
      "Prato montado", "Ingredientes", "Preparo", "Vista superior",
      "Ângulo lateral", "Textura", "Mesa posta", "Interior do restaurante",
      "Chef e equipe", "Bebidas", "Sobremesa", "Ação"
    ],
    landscape: [
      "Vista ampla", "Hora dourada", "Hora azul", "Primeiro plano",
      "Aérea", "Água e reflexos", "Montanha", "Floresta",
      "Horizonte urbano", "Noite e estrelas", "Tempestade", "Panorâmica"
    ],
    street: [
      "Pessoas espontâneas", "Arquitetura", "Reflexos", "Sombras e luz",
      "Movimento borrado", "Cena noturna", "Detalhe urbano", "Arte de rua",
      "Documentário", "Silhueta", "Camadas e profundidade", "Momento decisivo"
    ],
    sports: [
      "Ação", "Celebração", "Foto de equipe", "Atleta individual",
      "Grande angular", "Emoção", "Aquecimento", "Torcida",
      "Troféu", "Bastidores", "Vista aérea", "Equipamento"
    ],
  },

  ru: {
    wedding: [
      "Церемония", "Банкет", "Подготовка", "Первый танец",
      "Портрет пары", "Семейное фото", "Свита", "Кольца и детали",
      "Разрезание торта", "Место", "Живые моменты", "Проводы"
    ],
    portrait: [
      "Крупный план", "В полный рост", "Детали", "Профиль",
      "Средовой", "Студия", "Естественный свет", "Чёрно-белое",
      "Эмоция", "Постановочный", "Репортажный", "Креативный"
    ],
    newborn: [
      "Малыш один", "С родителями", "С братьями и сёстрами", "Детали крупно",
      "Спящий", "Запелёнатый", "С реквизитом", "Естественная поза",
      "Ручки и ножки", "Семья вместе", "Студия", "Лайфстайл"
    ],
    family: [
      "Групповой портрет", "Спонтанная игра", "Индивидуальный портрет", "Пара",
      "Дети вместе", "На улице", "В помещении", "Поколения",
      "Движение", "Объятия", "Смех", "Детали"
    ],
    event: [
      "Сцена", "Зрители", "Спикеры", "Нетворкинг",
      "Декор", "Еда и напитки", "Церемония награждения", "Групповое фото",
      "Живые моменты", "Брендинг", "За кулисами", "VIP-гости"
    ],
    commercial: [
      "Предметная съёмка", "Лайфстайл", "Раскладка", "Модель с товаром",
      "Интерьер", "Детали и текстура", "Брендинг", "Упаковка",
      "До и после", "Команда", "За кулисами", "Главный кадр"
    ],
    real_estate: [
      "Фасад", "Гостиная", "Кухня", "Спальня",
      "Ванная", "Столовая", "Сад", "Аэросъёмка",
      "Детали", "Район", "Планировка", "Сумерки"
    ],
    fashion: [
      "Подиум", "Эдиториал", "Лукбук", "Детали крупно",
      "Полный образ", "Аксессуар", "За кулисами", "Бьюти и макияж",
      "Уличный стиль", "Студия", "Локация", "Кампания"
    ],
    food: [
      "Готовое блюдо", "Ингредиенты", "Приготовление", "Сверху",
      "Сбоку", "Текстура крупно", "Сервировка", "Интерьер ресторана",
      "Шеф и команда", "Напитки", "Десерт", "Экшн"
    ],
    landscape: [
      "Широкий вид", "Золотой час", "Синий час", "Передний план",
      "Аэросъёмка", "Вода и отражение", "Горы", "Лес",
      "Городской горизонт", "Ночь и звёзды", "Шторм", "Панорама"
    ],
    street: [
      "Прохожие", "Архитектура", "Отражения", "Тени и свет",
      "Размытие движения", "Ночная сцена", "Городские детали", "Стрит-арт",
      "Документальный", "Силуэт", "Слои и глубина", "Решающий момент"
    ],
    sports: [
      "Экшн", "Празднование", "Командное фото", "Спортсмен",
      "Широкий ракурс", "Эмоция крупно", "Разминка", "Болельщики",
      "Трофей", "За кулисами", "С воздуха", "Снаряжение"
    ],
  },

  ja: {
    wedding: [
      "挙式", "披露宴", "支度", "ファーストダンス",
      "カップルポートレート", "集合写真", "ブライダルパーティー", "リング＆ディテール",
      "ケーキカット", "会場", "キャンディッド", "退場＆お見送り"
    ],
    portrait: [
      "ヘッドショット", "全身", "クローズアップ", "横顔",
      "環境ポートレート", "スタジオ", "自然光", "モノクロ",
      "表情", "ポーズ", "キャンディッド", "クリエイティブ"
    ],
    newborn: [
      "赤ちゃんソロ", "両親と", "兄弟と", "クローズアップ",
      "おやすみ", "おくるみ", "小物セット", "自然なポーズ",
      "手足", "家族一緒", "スタジオ", "ライフスタイル"
    ],
    family: [
      "集合ポートレート", "自然な遊び", "個人ポートレート", "カップル",
      "子供たち", "屋外", "屋内", "世代",
      "歩く＆動き", "ハグ", "笑い", "ディテール"
    ],
    event: [
      "ステージ", "観客", "登壇者", "交流",
      "装飾", "料理＆飲み物", "授賞式", "集合写真",
      "キャンディッド", "看板＆サイン", "舞台裏", "VIPゲスト"
    ],
    commercial: [
      "商品撮影", "ライフスタイル", "フラットレイ", "モデル＆商品",
      "インテリア", "ディテール＆質感", "ブランディング", "パッケージ",
      "ビフォーアフター", "チーム", "舞台裏", "メインビジュアル"
    ],
    real_estate: [
      "外観", "リビング", "キッチン", "ベッドルーム",
      "バスルーム", "ダイニング", "庭＆ガーデン", "空撮",
      "ディテール", "周辺環境", "間取り図", "トワイライト"
    ],
    fashion: [
      "ランウェイ", "エディトリアル", "ルックブック", "ディテール",
      "フルコーデ", "アクセサリー", "舞台裏", "ビューティー＆メイク",
      "ストリートスタイル", "スタジオ", "ロケーション", "キャンペーン"
    ],
    food: [
      "盛り付け", "食材", "調理", "俯瞰",
      "横アングル", "質感クローズアップ", "テーブルセッティング", "店内",
      "シェフ＆スタッフ", "ドリンク", "デザート", "アクション"
    ],
    landscape: [
      "広大な眺望", "ゴールデンアワー", "ブルーアワー", "前景",
      "空撮", "水面＆反射", "山", "森＆木々",
      "都市スカイライン", "星空", "嵐", "パノラマ"
    ],
    street: [
      "人物スナップ", "建築", "反射", "影と光",
      "モーションブラー", "夜景", "都市ディテール", "ストリートアート",
      "ドキュメンタリー", "シルエット", "レイヤー＆奥行き", "決定的瞬間"
    ],
    sports: [
      "アクション", "歓喜", "チーム写真", "選手個人",
      "ワイドアングル", "感情クローズアップ", "ウォームアップ", "ファン＆観客",
      "トロフィー", "舞台裏", "空撮", "用具ディテール"
    ],
  },

  de: {
    wedding: [
      "Zeremonie", "Empfang", "Vorbereitung", "Erster Tanz",
      "Paarporträt", "Familienfoto", "Brautjungfern", "Ringe & Details",
      "Torte anschneiden", "Location", "Spontane Momente", "Auszug & Abschied"
    ],
    portrait: [
      "Kopfbild", "Ganzkörper", "Nahaufnahme", "Profil",
      "Umgebungsporträt", "Studio", "Natürliches Licht", "Schwarz-Weiß",
      "Ausdruck", "Gestellt", "Spontan", "Kreativ"
    ],
    newborn: [
      "Baby allein", "Mit Eltern", "Mit Geschwistern", "Detailaufnahme",
      "Schlafend", "Eingewickelt", "Requisiten", "Natürliche Pose",
      "Hände & Füße", "Familie zusammen", "Studio", "Lifestyle"
    ],
    family: [
      "Gruppenporträt", "Spontanes Spiel", "Einzelporträt", "Paarfoto",
      "Kinder zusammen", "Draußen", "Drinnen", "Generationen",
      "Gehen & Bewegung", "Umarmung", "Lachen", "Details"
    ],
    event: [
      "Bühne", "Publikum", "Redner", "Networking",
      "Dekoration", "Essen & Trinken", "Preisverleihung", "Gruppenfoto",
      "Spontane Momente", "Beschilderung", "Hinter den Kulissen", "VIP-Gäste"
    ],
    commercial: [
      "Produktfoto", "Lifestyle", "Flat Lay", "Model mit Produkt",
      "Innenraum", "Detail & Textur", "Branding", "Verpackung",
      "Vorher & Nachher", "Team", "Hinter den Kulissen", "Heldenbild"
    ],
    real_estate: [
      "Außenansicht", "Wohnzimmer", "Küche", "Schlafzimmer",
      "Badezimmer", "Essbereich", "Garten", "Luftaufnahme",
      "Details", "Umgebung", "Grundriss", "Dämmerung"
    ],
    fashion: [
      "Laufsteg", "Editorial", "Lookbook", "Detailaufnahme",
      "Komplettes Outfit", "Accessoire", "Hinter den Kulissen", "Beauty & Make-up",
      "Street Style", "Studio", "Location", "Kampagne"
    ],
    food: [
      "Angerichtetes Gericht", "Zutaten", "Zubereitung", "Draufsicht",
      "Seitenansicht", "Textur", "Tischgedeck", "Restaurant-Interieur",
      "Koch & Team", "Getränke", "Dessert", "Aktion"
    ],
    landscape: [
      "Weite Sicht", "Goldene Stunde", "Blaue Stunde", "Vordergrund",
      "Luftaufnahme", "Wasser & Spiegelung", "Berg", "Wald",
      "Skyline", "Nacht & Sterne", "Unwetter", "Panorama"
    ],
    street: [
      "Passanten", "Architektur", "Spiegelungen", "Schatten & Licht",
      "Bewegungsunschärfe", "Nachtszene", "Urbanes Detail", "Street Art",
      "Dokumentarisch", "Silhouette", "Schichten & Tiefe", "Entscheidender Moment"
    ],
    sports: [
      "Actionfoto", "Jubel", "Teamfoto", "Einzelsportler",
      "Weitwinkel", "Emotion", "Aufwärmen", "Fans",
      "Trophäe", "Hinter den Kulissen", "Luftaufnahme", "Ausrüstung"
    ],
  },

  ko: {
    wedding: [
      "예식", "피로연", "준비", "첫 번째 댄스",
      "커플 포트레이트", "가족 사진", "들러리", "반지 & 디테일",
      "케이크 커팅", "장소", "캔디드 순간", "퇴장 & 배웅"
    ],
    portrait: [
      "헤드샷", "전신", "클로즈업", "프로필",
      "환경 인물", "스튜디오", "자연광", "흑백",
      "표정", "포즈", "캔디드", "크리에이티브"
    ],
    newborn: [
      "아기 단독", "부모와 함께", "형제와 함께", "디테일 클로즈업",
      "수면", "포대기", "소품 세팅", "자연 포즈",
      "손 & 발", "가족 함께", "스튜디오", "라이프스타일"
    ],
    family: [
      "단체 사진", "자연스러운 놀이", "개인 포트레이트", "커플 사진",
      "아이들 함께", "야외", "실내", "세대",
      "걷기 & 움직임", "포옹", "웃음", "디테일"
    ],
    event: [
      "무대 & 공연", "관객", "연사", "네트워킹",
      "장식 & 세팅", "음식 & 음료", "시상식", "단체 사진",
      "캔디드 순간", "브랜딩 & 사인", "비하인드", "VIP & 게스트"
    ],
    commercial: [
      "제품 촬영", "라이프스타일", "플랫레이", "모델 & 제품",
      "인테리어", "디테일 & 질감", "브랜딩", "패키지",
      "비포 & 애프터", "팀", "비하인드", "히어로 샷"
    ],
    real_estate: [
      "외관 정면", "거실", "주방", "침실",
      "욕실", "다이닝", "정원", "항공 촬영",
      "디테일", "주변 환경", "평면도", "황혼"
    ],
    fashion: [
      "런웨이", "에디토리얼", "룩북", "디테일 클로즈업",
      "풀 코디", "액세서리", "비하인드", "뷰티 & 메이크업",
      "스트리트 스타일", "스튜디오", "로케이션", "캠페인"
    ],
    food: [
      "완성된 요리", "재료", "조리 과정", "오버헤드",
      "사이드 앵글", "질감 클로즈업", "테이블 세팅", "레스토랑 인테리어",
      "셰프 & 스태프", "음료", "디저트", "액션 샷"
    ],
    landscape: [
      "넓은 전경", "골든 아워", "블루 아워", "전경 포인트",
      "항공 촬영", "수면 & 반사", "산", "숲 & 나무",
      "도시 스카이라인", "밤 & 별", "폭풍", "파노라마"
    ],
    street: [
      "캔디드 인물", "건축", "반사", "그림자 & 빛",
      "모션 블러", "야경", "도시 디테일", "스트리트 아트",
      "다큐멘터리", "실루엣", "레이어 & 깊이", "결정적 순간"
    ],
    sports: [
      "액션 샷", "세리머니", "팀 사진", "개인 선수",
      "와이드 앵글", "감정 클로즈업", "워밍업", "팬 & 관중",
      "트로피", "비하인드", "항공 뷰", "장비 디테일"
    ],
  },

  tr: {
    wedding: [
      "Tören", "Resepsiyon", "Hazırlık", "İlk Dans",
      "Çift Portresi", "Aile Fotoğrafı", "Nedimeler", "Yüzük ve Detaylar",
      "Pasta Kesimi", "Mekan", "Doğal Anlar", "Çıkış ve Uğurlama"
    ],
    portrait: [
      "Yüz Portresi", "Tam Boy", "Yakın Çekim", "Profil",
      "Çevresel", "Stüdyo", "Doğal Işık", "Siyah Beyaz",
      "İfade", "Pozlu", "Doğal", "Yaratıcı"
    ],
    newborn: [
      "Bebek Tek", "Ebeveynlerle", "Kardeşlerle", "Detay Yakın Çekim",
      "Uyuyan", "Sarılı", "Aksesuar", "Doğal Poz",
      "El ve Ayaklar", "Aile Birlikte", "Stüdyo", "Yaşam Tarzı"
    ],
    family: [
      "Grup Portresi", "Doğal Oyun", "Bireysel Portre", "Çift Fotoğrafı",
      "Çocuklar Birlikte", "Dış Mekan", "İç Mekan", "Kuşaklar",
      "Yürüyüş ve Hareket", "Sarılma", "Gülme", "Detaylar"
    ],
    event: [
      "Sahne", "Seyirci", "Konuşmacılar", "İletişim",
      "Dekorasyon", "Yiyecek ve İçecek", "Ödül Töreni", "Grup Fotoğrafı",
      "Doğal Anlar", "Tabela ve İşaret", "Kamera Arkası", "VIP Konuklar"
    ],
    commercial: [
      "Ürün Çekimi", "Yaşam Tarzı", "Düz Çekim", "Model ve Ürün",
      "İç Mekan", "Detay ve Doku", "Marka", "Ambalaj",
      "Önce ve Sonra", "Ekip", "Kamera Arkası", "Ana Görsel"
    ],
    real_estate: [
      "Dış Cephe", "Oturma Odası", "Mutfak", "Yatak Odası",
      "Banyo", "Yemek Alanı", "Bahçe", "Havadan",
      "Detaylar", "Çevre", "Kat Planı", "Alacakaranlık"
    ],
    fashion: [
      "Podyum", "Editöryal", "Lookbook", "Detay Çekim",
      "Tam Kombin", "Aksesuar", "Kamera Arkası", "Güzellik ve Makyaj",
      "Sokak Stili", "Stüdyo", "Lokasyon", "Kampanya"
    ],
    food: [
      "Tabak Sunumu", "Malzemeler", "Hazırlık", "Tepeden",
      "Yan Açı", "Doku Yakın Çekim", "Masa Düzeni", "Restoran İçi",
      "Şef ve Ekip", "İçecekler", "Tatlı", "Aksiyon Çekimi"
    ],
    landscape: [
      "Geniş Manzara", "Altın Saat", "Mavi Saat", "Ön Plan",
      "Havadan", "Su ve Yansıma", "Dağ", "Orman",
      "Şehir Silüeti", "Gece ve Yıldızlar", "Fırtına", "Panoramik"
    ],
    street: [
      "Doğal İnsanlar", "Mimari", "Yansımalar", "Gölge ve Işık",
      "Hareket Bulanıklığı", "Gece Sahnesi", "Kentsel Detay", "Sokak Sanatı",
      "Belgesel", "Silüet", "Katmanlar ve Derinlik", "Belirleyici An"
    ],
    sports: [
      "Aksiyon", "Kutlama", "Takım Fotoğrafı", "Bireysel Sporcu",
      "Geniş Açı", "Duygu Yakın Çekim", "Isınma", "Taraftarlar",
      "Kupa", "Kamera Arkası", "Havadan Görüntü", "Ekipman Detayı"
    ],
  },

  it: {
    wedding: [
      "Cerimonia", "Ricevimento", "Preparativi", "Primo ballo",
      "Ritratto di coppia", "Foto di famiglia", "Corteo", "Anelli e dettagli",
      "Taglio della torta", "Location", "Momenti spontanei", "Uscita e congedo"
    ],
    portrait: [
      "Primo piano", "Figura intera", "Close-up", "Profilo",
      "Ambientale", "Studio", "Luce naturale", "Bianco e nero",
      "Espressione", "In posa", "Spontaneo", "Creativo"
    ],
    newborn: [
      "Neonato solo", "Con i genitori", "Con i fratelli", "Dettagli",
      "Dormendo", "Avvolto", "Con accessori", "Posa naturale",
      "Mani e piedi", "Famiglia insieme", "Studio", "Lifestyle"
    ],
    family: [
      "Ritratto di gruppo", "Gioco spontaneo", "Ritratto individuale", "Foto di coppia",
      "Bambini insieme", "Esterno", "Interno", "Generazionale",
      "In cammino", "Abbraccio", "Risate", "Dettagli"
    ],
    event: [
      "Palco", "Pubblico", "Relatori", "Networking",
      "Allestimento", "Cibo e bevande", "Premiazione", "Foto di gruppo",
      "Momenti spontanei", "Insegne", "Dietro le quinte", "Ospiti VIP"
    ],
    commercial: [
      "Foto prodotto", "Lifestyle", "Flat lay", "Modello con prodotto",
      "Spazio interno", "Dettaglio e texture", "Branding", "Packaging",
      "Prima e dopo", "Team", "Dietro le quinte", "Immagine principale"
    ],
    real_estate: [
      "Esterno frontale", "Soggiorno", "Cucina", "Camera da letto",
      "Bagno", "Zona pranzo", "Giardino", "Vista aerea",
      "Dettagli", "Quartiere", "Pianta", "Crepuscolo"
    ],
    fashion: [
      "Passerella", "Editoriale", "Lookbook", "Dettaglio",
      "Outfit completo", "Accessorio", "Dietro le quinte", "Beauty e trucco",
      "Street style", "Studio", "Location", "Campagna"
    ],
    food: [
      "Piatto servito", "Ingredienti", "Preparazione", "Dall'alto",
      "Angolo laterale", "Texture", "Mise en place", "Interno ristorante",
      "Chef e staff", "Bevande", "Dessert", "Azione"
    ],
    landscape: [
      "Vista ampia", "Ora d'oro", "Ora blu", "Primo piano",
      "Vista aerea", "Acqua e riflessi", "Montagna", "Foresta",
      "Skyline urbano", "Notte e stelle", "Tempesta", "Panorama"
    ],
    street: [
      "Persone spontanee", "Architettura", "Riflessi", "Ombre e luce",
      "Mosso", "Scena notturna", "Dettaglio urbano", "Arte di strada",
      "Documentario", "Silhouette", "Livelli e profondità", "Momento decisivo"
    ],
    sports: [
      "Azione", "Esultanza", "Foto di squadra", "Singolo atleta",
      "Grandangolo", "Emozione", "Riscaldamento", "Tifosi",
      "Trofeo", "Dietro le quinte", "Vista aerea", "Attrezzatura"
    ],
  },
};

/**
 * Get culling labels for a gallery type in a specific language.
 * Falls back to English if translation is unavailable.
 */
export function getCullingLabels(galleryType: string, language: LanguageCode = "en"): string[] {
  const langLabels = translations[language];
  if (langLabels && langLabels[galleryType]) {
    return langLabels[galleryType];
  }
  // Fallback to English
  return labelsEN[galleryType] || labelsEN.wedding;
}

/**
 * Get all gallery types that have culling labels defined.
 */
export function getAvailableGalleryTypes(): string[] {
  return Object.keys(labelsEN);
}
