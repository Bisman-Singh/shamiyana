import type { Locale } from "@/lib/plan/constants";

/**
 * Privacy policy and terms. Every statement here describes what the code
 * does; when the code changes, this changes with it.
 */

export interface LegalPage {
  title: string;
  updated: string;
  sections: { heading: string; body: string[] }[];
}

const GEMINI_TERMS = "https://ai.google.dev/gemini-api/terms";

const privacyEn: LegalPage = {
  title: "Privacy",
  updated: "Last updated 23 October 2026",
  sections: [
    {
      heading: "No accounts, no database",
      body: [
        "Shamiyana has no sign-up and keeps no database of plans. Everything you type, including the guest list, vendor notes and amounts, is saved in your own browser's local storage on this device.",
        "Deleting a plan in the app, or clearing this site's data in your browser, removes it. We hold no copy to restore.",
      ],
    },
    {
      heading: "What is sent to the AI",
      body: [
        "When the app writes ideas, answers a chat message or looks at a photo, our server sends Google's Gemini API the event type and functions, date, city, guest count, budget, style, food preference and your notes, plus the chat message and the last few turns of the conversation, or the photo you picked.",
        "Before anything is sent, email addresses, phone numbers and identity numbers such as PAN and Aadhaar, in their common formats, are removed from typed text. The event name, guest list, vendor notes and payment amounts are never sent.",
        `Google processes this data under the Gemini API terms at ${GEMINI_TERMS}`,
        "This site uses the free tier of the Gemini API. Under Google's terms for it, Google may use what is sent and the answers to improve its products, and human reviewers may read them. Keep anything private out of your notes, messages and photos.",
      ],
    },
    {
      heading: "Photos",
      body: [
        "A photo you choose is shrunk in your browser and redrawn, which drops its location and camera data, then sent once for ideas. Our server does not store it. If a photo shows people, it is still sent as it is, so pick one you are comfortable sharing.",
      ],
    },
    {
      heading: "What our server keeps",
      body: [
        "For each AI request the server logs the time, which feature was used, the outcome, how long it took and which model answered. It does not log your event details, messages, photos or IP address.",
        "To limit abuse, the server counts AI requests from each network address, per minute and per day. The counts are kept in a Redis database run by Upstash, under a one-way code made from the address with a secret key rather than the address itself, and expire on their own within a day. To save cost, a finished AI answer can be kept in server memory for up to six hours and reused for exactly the same event details. None of this is linked to you.",
        "The hosting provider may keep its own standard request logs, including IP addresses, for security and operations.",
      ],
    },
    {
      heading: "Share links",
      body: [
        "A share link carries the plan after the # sign. Browsers do not send that part to any server, so we never see a shared plan, but anyone who has the link can open a copy. Share links leave out the guest list and vendor notes.",
      ],
    },
    {
      heading: "Cookies",
      body: [
        "One cookie, named lang, remembers whether you chose English or Hindi, for a year. There are no analytics, advertising or tracking cookies or scripts.",
      ],
    },
    {
      heading: "Children",
      body: [
        "Shamiyana is meant for adults planning an event. Please don't type details about a child beyond what the plan needs; a child's name, for example, never needs to go in the notes.",
      ],
    },
    {
      heading: "Questions",
      body: [
        "For a question or a complaint about privacy, open an issue on the project's GitHub page at https://github.com/Bisman-Singh/shamiyana/issues",
      ],
    },
  ],
};

const privacyHi: LegalPage = {
  title: "निजता",
  updated: "आख़िरी बदलाव 23 अक्टूबर 2026",
  sections: [
    {
      heading: "न खाता, न डेटाबेस",
      body: [
        "शामियाना में साइन-अप नहीं है और योजनाओं का कोई डेटाबेस नहीं रखा जाता। आप जो भी लिखते हैं, मेहमानों की सूची, वेंडर नोट और रक़में भी, वह इसी डिवाइस पर आपके ब्राउज़र के लोकल स्टोरेज में सहेजा जाता है।",
        "ऐप में योजना हटाने से, या ब्राउज़र में इस साइट का डेटा साफ़ करने से, वह मिट जाती है। हमारे पास वापस लाने के लिए कोई कॉपी नहीं होती।",
      ],
    },
    {
      heading: "AI को क्या भेजा जाता है",
      body: [
        "जब ऐप सुझाव लिखता है, बातचीत का जवाब देता है या फ़ोटो देखता है, तब हमारा सर्वर Google के Gemini API को आयोजन का प्रकार और रस्में, तारीख़, शहर, मेहमानों की संख्या, बजट, अंदाज़, खाने की पसंद और आपके नोट भेजता है, साथ में बातचीत का संदेश और पिछली कुछ बातें, या आपकी चुनी हुई फ़ोटो।",
        "भेजने से पहले लिखे गए पाठ से ईमेल पते, फ़ोन नंबर और PAN व आधार जैसे पहचान नंबर, अपने आम रूपों में, हटा दिए जाते हैं। आयोजन का नाम, मेहमानों की सूची, वेंडर नोट और भुगतान की रक़में कभी नहीं भेजी जातीं।",
        `Google यह डेटा Gemini API की शर्तों के तहत प्रोसेस करता है, जो ${GEMINI_TERMS} पर हैं।`,
        "यह साइट Gemini API का मुफ़्त टियर इस्तेमाल करती है। उसकी शर्तों के तहत Google भेजी गई जानकारी और जवाबों को अपने उत्पाद बेहतर करने में इस्तेमाल कर सकता है, और लोग इन्हें पढ़ सकते हैं। अपने नोट, संदेश और फ़ोटो में कुछ भी निजी न डालें।",
      ],
    },
    {
      heading: "फ़ोटो",
      body: [
        "आपकी चुनी फ़ोटो आपके ब्राउज़र में छोटी करके दोबारा बनाई जाती है, जिससे उसकी लोकेशन और कैमरे की जानकारी हट जाती है, फिर सुझावों के लिए एक बार भेजी जाती है। हमारा सर्वर उसे सहेजता नहीं। अगर फ़ोटो में लोग हैं तो वे भी वैसे ही भेजे जाएँगे, इसलिए वही फ़ोटो चुनें जिसे साझा करने में आपको आपत्ति न हो।",
      ],
    },
    {
      heading: "हमारा सर्वर क्या रखता है",
      body: [
        "हर AI अनुरोध के लिए सर्वर समय, कौन-सी सुविधा इस्तेमाल हुई, नतीजा, कितना समय लगा और किस मॉडल ने जवाब दिया, यह दर्ज करता है। आपके आयोजन का विवरण, संदेश, फ़ोटो या IP पता दर्ज नहीं होता।",
        "दुरुपयोग रोकने के लिए सर्वर हर नेटवर्क पते से आए AI अनुरोध प्रति मिनट और प्रति दिन गिनता है। ये गिनतियाँ Upstash के Redis डेटाबेस में रखी जाती हैं। उनमें आपका पता नहीं, बल्कि एक गुप्त कुंजी से उस पते से बनाया गया एकतरफ़ा कोड होता है, और वे एक दिन के भीतर अपने-आप मिट जाती हैं। ख़र्च बचाने के लिए पूरा हुआ AI जवाब छह घंटे तक सर्वर की मेमोरी में रखा जा सकता है और ठीक उसी विवरण पर दोबारा दिया जा सकता है। इनमें से कुछ भी आपसे नहीं जोड़ा जाता।",
        "होस्टिंग कंपनी सुरक्षा और संचालन के लिए अपने सामान्य रिकॉर्ड रख सकती है, जिनमें IP पते भी होते हैं।",
      ],
    },
    {
      heading: "साझा लिंक",
      body: [
        "साझा लिंक में योजना # चिह्न के बाद होती है। ब्राउज़र यह हिस्सा किसी सर्वर को नहीं भेजते, इसलिए हम साझा योजना कभी नहीं देखते, पर जिसके पास लिंक है वह उसकी कॉपी खोल सकता है। साझा लिंक में मेहमानों की सूची और वेंडर नोट शामिल नहीं होते।",
      ],
    },
    {
      heading: "कुकी",
      body: [
        "सिर्फ़ एक कुकी, lang, एक साल तक याद रखती है कि आपने अंग्रेज़ी चुनी या हिंदी। कोई एनालिटिक्स, विज्ञापन या ट्रैकिंग कुकी या स्क्रिप्ट नहीं है।",
      ],
    },
    {
      heading: "बच्चे",
      body: [
        "शामियाना आयोजन की योजना बनाने वाले वयस्कों के लिए है। कृपया किसी बच्चे के बारे में उतना ही लिखें जितना योजना के लिए ज़रूरी हो; जैसे, बच्चे का नाम नोट में लिखने की कभी ज़रूरत नहीं।",
      ],
    },
    {
      heading: "सवाल",
      body: [
        "निजता से जुड़े सवाल या शिकायत के लिए प्रोजेक्ट के GitHub पेज https://github.com/Bisman-Singh/shamiyana/issues पर issue खोलें।",
      ],
    },
  ],
};

const termsEn: LegalPage = {
  title: "Terms",
  updated: "Last updated 21 October 2026",
  sections: [
    {
      heading: "What this is",
      body: [
        "Shamiyana is a free planning tool. It is offered as it is, without any warranty, and may change or stop at any time.",
      ],
    },
    {
      heading: "AI suggestions",
      body: [
        "Ideas, menus, budget shifts, tasks and answers are written by an AI model and can be wrong. Budget splits are typical shares, not quotes. Check prices, availability, permissions and safety rules with vendors and local authorities before you rely on them or pay anyone.",
        "Nothing here is legal, financial or professional advice.",
      ],
    },
    {
      heading: "Your part",
      body: [
        "Only upload photos you have the right to use, and don't use the tool for anything unlawful or to overload it. AI features have per-minute and daily limits so the service stays available to everyone.",
        "Your plans live in your browser. Download a backup if a plan matters to you; we can't recover a deleted or cleared plan.",
      ],
    },
  ],
};

const termsHi: LegalPage = {
  title: "शर्तें",
  updated: "आख़िरी बदलाव 21 अक्टूबर 2026",
  sections: [
    {
      heading: "यह क्या है",
      body: [
        "शामियाना योजना बनाने का एक मुफ़्त टूल है। यह जैसा है वैसा दिया जाता है, बिना किसी वारंटी के, और कभी भी बदल या बंद हो सकता है।",
      ],
    },
    {
      heading: "AI के सुझाव",
      body: [
        "सुझाव, मेन्यू, बजट में बदलाव, काम और जवाब एक AI मॉडल लिखता है और ये ग़लत हो सकते हैं। बजट का बँटवारा आम अनुपात है, कोटेशन नहीं। भरोसा करने या किसी को पैसे देने से पहले वेंडर और स्थानीय प्रशासन से दाम, उपलब्धता, अनुमति और सुरक्षा नियम पक्के करें।",
        "यहाँ कुछ भी क़ानूनी, वित्तीय या पेशेवर सलाह नहीं है।",
      ],
    },
    {
      heading: "आपकी ज़िम्मेदारी",
      body: [
        "वही फ़ोटो अपलोड करें जिन्हें इस्तेमाल करने का आपको हक़ है, और टूल का इस्तेमाल किसी ग़ैरक़ानूनी काम या उस पर बोझ डालने के लिए न करें। AI सुविधाओं की प्रति मिनट और रोज़ की सीमा है ताकि सेवा सबके लिए चलती रहे।",
        "आपकी योजनाएँ आपके ब्राउज़र में रहती हैं। ज़रूरी योजना का बैकअप डाउनलोड कर लें; हटाई या साफ़ की गई योजना हम वापस नहीं ला सकते।",
      ],
    },
  ],
};

export const LEGAL: Record<"privacy" | "terms", Record<Locale, LegalPage>> = {
  privacy: { en: privacyEn, hi: privacyHi },
  terms: { en: termsEn, hi: termsHi },
};
