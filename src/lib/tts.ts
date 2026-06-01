// Helper to create a seeded random number generator
function seededRandom(str: string) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    // return a pseudo-random value between 0 and 1
    const x = Math.sin(hash++) * 10000;
    return x - Math.floor(x);
}

export function playTTS(text: string, username: string, customPitch?: number, customRate?: number) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    // Create utterance
    const utterance = new SpeechSynthesisUtterance(text);

    // Seeded random based on username
    const rnd1 = seededRandom(username + "voice");
    const rnd2 = seededRandom(username + "pitch");
    const rnd3 = seededRandom(username + "rate");

    // 1. Pick a French voice
    const voices = window.speechSynthesis.getVoices();
    const frVoices = voices.filter(v => v.lang.startsWith('fr'));

    if (frVoices.length > 0) {
        // Pick consistently the same voice for the same user
        const voiceIndex = Math.floor(rnd1 * frVoices.length);
        utterance.voice = frVoices[voiceIndex];
    } else if (voices.length > 0) {
        // Fallback to any voice if no French voice found
        const voiceIndex = Math.floor(rnd1 * voices.length);
        utterance.voice = voices[voiceIndex];
    }

    // 2. Set pitch (between 0.1 and 2.0) - make it extreme for funny results
    // We map rnd2 (0 to 1) to [0.1, 2.0]
    utterance.pitch = customPitch !== undefined ? customPitch : (0.1 + (rnd2 * 1.9));

    // 3. Set rate (between 0.5 and 1.5)
    utterance.rate = customRate !== undefined ? customRate : (0.5 + (rnd3 * 1.0));

    window.speechSynthesis.speak(utterance);
}
