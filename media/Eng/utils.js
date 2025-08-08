
// Helpers: TTS, speech recognition wrapper, string utils, shuffle, score

export function speak(text, lang='en-US', rate=0.95, pitch=1.0) {
  if (!('speechSynthesis' in window)) {
    alert('Text-to-Speech is not supported on this browser.');
    return;
  }
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.rate = rate;
  utter.pitch = pitch;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

export function hasSpeechRecognition(){
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
}

export function startRecognition({lang='en-US', onResult, onEnd}={}){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { alert('Speech Recognition not supported.'); return null; }
  const rec = new SR();
  rec.lang = lang;
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.onresult = (e)=>{
    const text = e.results[0][0].transcript;
    onResult && onResult(text);
  };
  rec.onend = ()=>{ onEnd && onEnd(); };
  rec.start();
  return rec;
}

export function normalize(s){
  return s.toLowerCase().replace(/[^a-z0-9\s']/g,'').replace(/\s+/g,' ').trim();
}

export function wordErrorRate(ref, hyp){
  const r = normalize(ref).split(' ');
  const h = normalize(hyp).split(' ');
  const R = r.length, H = h.length;
  const dp = Array.from({length:R+1}, ()=>Array(H+1).fill(0));
  for (let i=0;i<=R;i++) dp[i][0]=i;
  for (let j=0;j<=H;j++) dp[0][j]=j;
  for (let i=1;i<=R;i++){
    for (let j=1;j<=H;j++){
      const cost = r[i-1]===h[j-1]?0:1;
      dp[i][j] = Math.min(
        dp[i-1][j]+1,      // deletion
        dp[i][j-1]+1,      // insertion
        dp[i-1][j-1]+cost  // substitution
      );
    }
  }
  return dp[R][H] / Math.max(R,1);
}

export function shuffle(arr){
  return arr.map(v=>[v, Math.random()]).sort((a,b)=>a[1]-b[1]).map(v=>v[0]);
}

export function saveProgress(key, data){
  localStorage.setItem(key, JSON.stringify(data));
}

export function loadProgress(key, def){
  try {
    const d = JSON.parse(localStorage.getItem(key));
    return d ?? def;
  } catch { return def; }
}
