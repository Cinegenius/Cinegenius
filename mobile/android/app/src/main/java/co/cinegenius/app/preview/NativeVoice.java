package co.cinegenius.app.preview;

import android.Manifest;
import android.content.Intent;
import android.content.Context;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Bundle;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import android.webkit.WebView;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.ContextCompat;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Locale;
import java.util.Map;

/** Ephemeral OS speech only. No file storage, account data or Genie API calls. */
final class NativeVoice {
    private final MainActivity activity;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final ActivityResultLauncher<String> microphone;
    private WebView webView;
    private String configuredOrigin;
    private SpeechRecognizer recognizer;
    private TextToSpeech synthesizer;
    private boolean ttsReady, foreground, stopping;
    private Request recording, speaking, permissionRequest;
    private long captureStarted, finalizationStarted, requestStarted, speechStarted;
    private String lastUtterance;
    private AudioManager audioManager;
    private AudioFocusRequest audioFocus;
    private final AudioManager.OnAudioFocusChangeListener focusListener=change -> {if(change<0)cancelAll("interrupted");};
    private static final class Request {
        final VoiceCommand command; final String url; final JavaScriptReplyProxy reply;
        Request(VoiceCommand command,String url,JavaScriptReplyProxy reply) {this.command=command;this.url=url;this.reply=reply;}
    }
    NativeVoice(MainActivity activity) {
        this.activity=activity;
        microphone=activity.registerForActivityResult(new ActivityResultContracts.RequestPermission(), granted -> {
            Request request=permissionRequest; permissionRequest=null;
            if (request==null || recording!=request) return;
            if (!current(request)) {cancelAll("interrupted");return;}
            if (granted) beginRecognition(request); else finishRecording("permission-denied",null);
        });
        synthesizer=new TextToSpeech(activity,status -> handler.post(() -> ttsReady=status==TextToSpeech.SUCCESS));
        synthesizer.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String id) {handler.post(() -> {if(matches(speaking,id))state(speaking,"speaking",null);});}
            @Override public void onDone(String id) {handler.post(() -> {if(matches(speaking,id)&&id.equals(lastUtterance))finishSpeaking(null);});}
            @Override public void onError(String id) {handler.post(() -> {if(matches(speaking,id))finishSpeaking("audio");});}
        });
    }
    void install(WebView view,String origin,String script) {
        if(view==null||origin==null||script==null)return;
        if(!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER))return;
        if(!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT))return;
        webView=view;configuredOrigin=origin;
        try {
            WebViewCompat.addWebMessageListener(view,"cinegeniusVoiceNative",Collections.singleton(origin),(source,message,sourceOrigin,mainFrame,reply) -> {
                if(source!=webView||!mainFrame||!AppWebOrigin.matches(origin,sourceOrigin.toString())
                    ||!AppWebOrigin.matches(origin,source.getUrl())||!foreground)return;
                try {
                    String raw=message.getData();if(raw==null||raw.length()>42000)return;
                    JSONObject json=new JSONObject(raw);Map<String,Object> values=new HashMap<>();
                    for(Iterator<String> keys=json.keys();keys.hasNext();) {String key=keys.next();values.put(key,json.get(key));}
                    VoiceCommand command=VoiceCommand.parse(values);if(command==null)return;
                    Request request=new Request(command,source.getUrl(),reply);
                    try {receive(request);} catch(Exception ignored) {fail(request,"unavailable");}
                } catch(Exception ignored) { /* Reject malformed input without logging speech or identifiers. */ }
            });
            WebViewCompat.addDocumentStartJavaScript(view,script,Collections.singleton(origin));
        } catch(IllegalArgumentException|UnsupportedOperationException ignored) {
            // Unsupported providers keep their regular web UI; never expose a broad JS interface.
        }
    }
    private boolean current(Request request) {
        return foreground&&webView!=null&&request.url.equals(webView.getUrl())&&AppWebOrigin.matches(configuredOrigin,webView.getUrl());
    }
    private boolean matches(Request request,String id) {return request!=null&&id!=null&&id.startsWith(request.command.requestId+":");}
    private boolean targets(Request request,VoiceCommand command) {
        return request!=null&&request.command.requestId.equals(command.requestId)&&request.command.documentId.equals(command.documentId);
    }
    private void send(Request request,String type,JSONObject values) {
        if(!current(request))return;
        if(!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER))return;
        try {
            values.put("v",1).put("documentId",request.command.documentId).put("requestId",request.command.requestId).put("type",type);
            request.reply.postMessage(values.toString());
        }catch(Exception ignored) { /* A detached document cannot receive late results. */ }
    }
    private void fail(Request request,String code) {try{send(request,"error",new JSONObject().put("code",code));}catch(Exception ignored){}}
    private void state(Request request,String state,String partial) {
        try{JSONObject value=new JSONObject().put("state",state);if(partial!=null)value.put("partialText",partial);send(request,"state",value);}catch(Exception ignored){}
    }
    private void result(Request request,JSONObject result) {try{send(request,"result",new JSONObject().put("result",result));}catch(Exception ignored){}}
    private void receive(Request request) throws Exception {
        VoiceCommand command=request.command;
        switch(command.action) {
            case "capabilities":
                result(request,new JSONObject().put("recognition",SpeechRecognizer.isRecognitionAvailable(activity))
                    .put("synthesis",localVoice(command.languageTag)!=null).put("systemServiceMayProcessAudio",true));break;
            case "start":
                if(recording!=null||permissionRequest!=null){fail(request,"busy");break;}
                if(!SpeechRecognizer.isRecognitionAvailable(activity)){fail(request,"unavailable");break;}
                finishSpeaking("cancelled");recording=request;stopping=false;captureStarted=0;finalizationStarted=0;
                requestStarted=SystemClock.uptimeMillis();
                handler.post(watchdog);state(request,"requesting-permission",null);
                if(ContextCompat.checkSelfPermission(activity,Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED)beginRecognition(request);
                else {
                    permissionRequest=request;
                    try {microphone.launch(Manifest.permission.RECORD_AUDIO);}
                    catch(RuntimeException ignored){permissionRequest=null;finishRecording("unavailable",null);}
                }
                break;
            case "stop":if(targets(recording,command))stopRecognition();break;
            case "cancel":if(targets(recording,command))finishRecording("cancelled",null);break;
            case "speak":speak(request);break;
            case "stopSpeaking":if(targets(speaking,command))finishSpeaking("cancelled");break;
        }
    }
    private void beginRecognition(Request request) {
        if(recording!=request||!current(request))return;
        if(ContextCompat.checkSelfPermission(activity,Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){finishRecording("permission-denied",null);return;}
        try {
            if(!acquireAudioFocus()){finishRecording("audio",null);return;}
            recognizer=SpeechRecognizer.createSpeechRecognizer(activity);
            recognizer.setRecognitionListener(new RecognitionListener() {
                private boolean active(){return recording==request&&current(request);}
                @Override public void onReadyForSpeech(Bundle params){if(active())state(request,"listening",null);}
                @Override public void onBeginningOfSpeech(){}
                @Override public void onRmsChanged(float value){}
                @Override public void onBufferReceived(byte[] buffer){}
                @Override public void onEndOfSpeech(){if(active()){stopping=true;finalizationStarted=SystemClock.uptimeMillis();state(request,"processing",null);}}
                @Override public void onError(int code){if(active())finishRecording(errorCode(code),null);}
                @Override public void onResults(Bundle bundle){if(active())finishRecording(null,transcript(bundle));}
                @Override public void onPartialResults(Bundle bundle){if(active()){String value=transcript(bundle);state(request,"listening",value.substring(0,Math.min(6000,value.length())));}}
                @Override public void onEvent(int event,Bundle params){}
            });
            Intent intent=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE,request.command.languageTag);
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS,true);
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS,1);
            intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE,true);
            captureStarted=SystemClock.uptimeMillis();recognizer.startListening(intent);
        }catch(Exception ignored){finishRecording("audio",null);}
    }
    private String transcript(Bundle bundle) {
        ArrayList<String> values=bundle==null?null:bundle.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        String value=values==null||values.isEmpty()?"":values.get(0);
        return value==null?"":value;
    }
    private String errorCode(int code) {
        switch(code) {
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:return "permission-denied";
            case SpeechRecognizer.ERROR_NO_MATCH:case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:return "no-speech";
            case SpeechRecognizer.ERROR_NETWORK:case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:case SpeechRecognizer.ERROR_SERVER:case SpeechRecognizer.ERROR_SERVER_DISCONNECTED:return "network";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:case SpeechRecognizer.ERROR_TOO_MANY_REQUESTS:return "busy";
            case SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED:case SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE:return "language-unavailable";
            default:return "audio";
        }
    }
    private void stopRecognition() {
        if(recording==null||stopping)return;
        if(recognizer==null){finishRecording("cancelled",null);return;}
        stopping=true;finalizationStarted=SystemClock.uptimeMillis();state(recording,"processing",null);
        try{recognizer.stopListening();}catch(Exception ignored){finishRecording("audio",null);}
    }
    private void finishRecording(String code,String text) {
        Request request=recording;recording=null;captureStarted=0;stopping=false;
        if(recognizer!=null){SpeechRecognizer old=recognizer;recognizer=null;try{old.cancel();}catch(RuntimeException ignored){}try{old.destroy();}catch(RuntimeException ignored){}}
        if(request==null)return;
        releaseAudioFocus();
        if(code!=null)fail(request,code);
        else if(text==null||text.trim().isEmpty())fail(request,"no-speech");
        else if(text.length()>6000)fail(request,"invalid-request");
        else try{result(request,new JSONObject().put("text",text));}catch(Exception ignored){fail(request,"audio");}
    }
    private Voice localVoice(String tag) {
        if(!ttsReady||synthesizer==null||synthesizer.getVoices()==null)return null;
        Locale locale=Locale.forLanguageTag(tag);ArrayList<Voice> candidates=new ArrayList<>();
        for(Voice voice:synthesizer.getVoices()) {
            if(voice.isNetworkConnectionRequired()||!voice.getLocale().getLanguage().equals(locale.getLanguage()))continue;
            if(voice.getFeatures()!=null&&voice.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED))continue;
            candidates.add(voice);
        }
        Voice defaultVoice=synthesizer.getDefaultVoice();
        candidates.sort((left,right)->{
            int region=Boolean.compare(right.getLocale().getCountry().equals(locale.getCountry()),left.getLocale().getCountry().equals(locale.getCountry()));
            if(region!=0)return region;
            int quality=Integer.compare(right.getQuality(),left.getQuality());
            if(quality!=0)return quality;
            int preferred=Boolean.compare(right.equals(defaultVoice),left.equals(defaultVoice));
            if(preferred!=0)return preferred;
            return left.getName().compareTo(right.getName());
        });
        return candidates.isEmpty()?null:candidates.get(0);
    }
    private void speak(Request request) {
        Voice voice=localVoice(request.command.languageTag);
        if(voice==null){fail(request,ttsReady?"language-unavailable":"unavailable");return;}
        finishRecording("cancelled",null);finishSpeaking("cancelled");speaking=request;
        if(!acquireAudioFocus()||synthesizer.setVoice(voice)==TextToSpeech.ERROR
            ||synthesizer.setSpeechRate(0.94f)==TextToSpeech.ERROR){finishSpeaking("audio");return;}
        speechStarted=SystemClock.uptimeMillis();handler.post(watchdog);
        // Respect each engine's input limit without truncating the reply.
        String text=request.command.text;int limit=TextToSpeech.getMaxSpeechInputLength()-1;
        if(limit<2){finishSpeaking("unavailable");return;}
        ArrayList<String> chunks=new ArrayList<>();
        for(int start=0;start<text.length();) {
            int end=Math.min(start+limit,text.length());
            if(end<text.length()&&Character.isHighSurrogate(text.charAt(end-1)))end--;
            chunks.add(text.substring(start,end));start=end;
        }
        lastUtterance=request.command.requestId+":"+(chunks.size()-1);
        // Per-utterance volume keeps the device's own volume setting unchanged.
        Bundle speechParameters=new Bundle();speechParameters.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME,0.85f);
        for(int index=0;index<chunks.size();index++) {
            if(synthesizer.speak(chunks.get(index),index==0?TextToSpeech.QUEUE_FLUSH:TextToSpeech.QUEUE_ADD,speechParameters,request.command.requestId+":"+index)==TextToSpeech.ERROR){finishSpeaking("audio");break;}
        }
    }
    private void finishSpeaking(String code) {
        Request request=speaking;speaking=null;
        lastUtterance=null;
        if(synthesizer!=null)try{synthesizer.stop();}catch(RuntimeException ignored){}
        if(request!=null)releaseAudioFocus();
        if(request!=null){if(code==null)result(request,new JSONObject());else fail(request,code);}
    }
    private final Runnable watchdog=new Runnable() {
        @Override public void run() {
            handler.removeCallbacks(this);
            if((recording!=null&&!current(recording))||(speaking!=null&&!current(speaking))){cancelAll("interrupted");return;}
            long now=SystemClock.uptimeMillis();
            if(recording!=null&&stopping&&now-finalizationStarted>8000)finishRecording("timeout",null);
            else if(recording!=null&&captureStarted>0&&now-captureStarted>=30000)stopRecognition();
            else if(recording!=null&&captureStarted==0&&now-requestStarted>=45000)finishRecording("timeout",null);
            if(speaking!=null&&now-speechStarted>=115000)finishSpeaking("timeout");
            if(recording!=null||speaking!=null)handler.postDelayed(this,250);
        }
    };
    private boolean acquireAudioFocus() {
        audioManager=(AudioManager)activity.getSystemService(Context.AUDIO_SERVICE);
        if(audioManager==null)return false;
        if(Build.VERSION.SDK_INT<26)return audioManager.requestAudioFocus(focusListener,AudioManager.STREAM_MUSIC,AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)==AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
        audioFocus=new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
            .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANT).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
            .setOnAudioFocusChangeListener(focusListener,handler).build();
        return audioManager.requestAudioFocus(audioFocus)==AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
    }
    private void releaseAudioFocus(){
        if(audioManager!=null){
            if(Build.VERSION.SDK_INT>=26&&audioFocus!=null)audioManager.abandonAudioFocusRequest(audioFocus);
            else if(Build.VERSION.SDK_INT<26)audioManager.abandonAudioFocus(focusListener);
        }
        audioFocus=null;
    }
    void cancelAll(String code){finishRecording(code,null);finishSpeaking(code);handler.removeCallbacks(watchdog);}
    void resume(){foreground=true;}
    void suspend(){cancelAll("interrupted");foreground=false;}
    void pauseAudio(){if(captureStarted>0||speaking!=null)cancelAll("interrupted");}
    void destroy(){suspend();if(synthesizer!=null){synthesizer.shutdown();synthesizer=null;}}
}
