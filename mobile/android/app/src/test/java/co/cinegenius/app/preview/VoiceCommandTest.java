package co.cinegenius.app.preview;

import static org.junit.Assert.*;
import org.junit.Test;
import java.util.HashMap;
import java.util.Map;

public class VoiceCommandTest {
    private Map<String,Object> command(String action) {
        Map<String,Object> value=new HashMap<>();
        value.put("v",1);value.put("documentId","5fe4d83f-7c7c-4d22-a078-1e03db8a0e84");
        value.put("requestId","7ce6da09-70eb-4d50-b04d-b8a0ba6b9b2b");value.put("action",action);
        return value;
    }
    @Test public void mapsAllNineLocalesExplicitly() {
        String[][] expected={{"de","de-DE"},{"en","en-GB"},{"es","es-ES"},{"it","it-IT"},{"cs","cs-CZ"},
            {"hu","hu-HU"},{"nl","nl-NL"},{"nl-BE","nl-BE"},{"sv","sv-SE"}};
        for(String[] row:expected){Map<String,Object> value=command("start");value.put("locale",row[0]);assertEquals(row[1],VoiceCommand.parse(value).languageTag);}
    }
    @Test public void rejectsUnsupportedActionsAndPrivatePayloads() {
        for(String action:new String[]{"send","publish","fetch","openURL","editPlan"})assertNull(VoiceCommand.parse(command(action)));
        for(String key:new String[]{"token","accountID","filePath","url","audio","plan"}){
            Map<String,Object> value=command("cancel");value.put(key,"private");assertNull(VoiceCommand.parse(value));
        }
    }
    @Test public void rejectsMissingMalformedAndOversizedIdentifiers() {
        for(Object id:new Object[]{null,17,"short","a".repeat(65),"../private-recording-file","a".repeat(16)+"\n"}) {
            Map<String,Object> value=command("cancel");value.put("documentId",id);assertNull(VoiceCommand.parse(value));
        }
        for(Object version:new Object[]{null,"1",true,2,Double.NaN}){
            Map<String,Object> value=command("cancel");value.put("v",version);assertNull(VoiceCommand.parse(value));
        }
    }
    @Test public void speechRequiresKnownLanguageAndBoundedNonemptyText() {
        Map<String,Object> value=command("speak");value.put("locale","de");
        for(Object text:new Object[]{null,"","  ",42,"a".repeat(6001)}){value.put("text",text);assertNull(VoiceCommand.parse(value));}
        value.put("text","München: \"Kamera\" <script>data only</script>");
        assertEquals(value.get("text"),VoiceCommand.parse(value).text);
        value.put("locale","fr");assertNull(VoiceCommand.parse(value));
    }
    @Test public void controlMessagesTargetOnlyDocumentAndRequest() {
        for(String action:new String[]{"stop","cancel","stopSpeaking"}) {
            Map<String,Object> value=command(action);assertNotNull(VoiceCommand.parse(value));
            value.put("locale","de");assertNull(VoiceCommand.parse(value));value.remove("locale");
            value.put("text","ignored?");assertNull(VoiceCommand.parse(value));
        }
    }
}
