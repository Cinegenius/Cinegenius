package co.cinegenius.app.preview;

import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

final class VoiceCommand {
    private static final Set<String> ACTIONS = new HashSet<>(Arrays.asList("capabilities", "start", "stop", "cancel", "speak", "stopSpeaking"));
    private static final Set<String> KEYS = new HashSet<>(Arrays.asList("v", "documentId", "requestId", "action", "locale", "text"));
    private static final Map<String, String> TAGS = new HashMap<>();
    static {
        String[][] rows = {{"de","de-DE"},{"en","en-GB"},{"es","es-ES"},{"it","it-IT"},{"cs","cs-CZ"},
            {"hu","hu-HU"},{"nl","nl-NL"},{"nl-BE","nl-BE"},{"sv","sv-SE"}};
        for (String[] row : rows) TAGS.put(row[0], row[1]);
    }
    final String documentId, requestId, action, locale, languageTag, text;
    private VoiceCommand(Map<String,Object> value) {
        documentId=(String)value.get("documentId"); requestId=(String)value.get("requestId");
        action=(String)value.get("action"); locale=(String)value.get("locale");
        languageTag=TAGS.get(locale); text=(String)value.get("text");
    }
    static VoiceCommand parse(Map<String,Object> value) {
        if (!KEYS.containsAll(value.keySet()) || !(value.get("v") instanceof Number)
            || ((Number)value.get("v")).doubleValue()!=1 || !identifier(value.get("documentId"))
            || !identifier(value.get("requestId")) || !ACTIONS.contains(value.get("action"))) return null;
        String action=(String)value.get("action");
        boolean needsLocale=Arrays.asList("capabilities","start","speak").contains(action);
        if (needsLocale ? !TAGS.containsKey(value.get("locale")) : value.containsKey("locale")) return null;
        if (action.equals("speak")) {
            if (!(value.get("text") instanceof String)) return null;
            String text=(String)value.get("text");
            if (text.trim().isEmpty() || text.length()>6000) return null;
        } else if (value.containsKey("text")) return null;
        return new VoiceCommand(value);
    }
    private static boolean identifier(Object value) {
        return value instanceof String && ((String)value).matches("[A-Za-z0-9-]{16,64}");
    }
}
