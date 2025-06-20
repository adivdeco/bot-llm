// ✅ Move these to the top
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs';
import wav from 'wav';
import player from 'node-wav-player';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

// Required for __dirname in ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = 5501;
const ai = new GoogleGenAI({ apiKey: 'AIzaSyBdNAz8WjXnVZrLbfY7yb7OMxFgB7QNwR4' }); // Replace with your key

const History = [];

app.use(cors());
app.use(bodyParser.json());

async function saveWaveFile(filename, pcmData, channels = 1, rate = 24000, sampleWidth = 2) {
  return new Promise((resolve, reject) => {
    const writer = new wav.FileWriter(filename, {
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    writer.on('finish', () => resolve());
    writer.on('error', (err) => reject(err));
    writer.write(pcmData);
    writer.end();
  });
}

async function speakText(text, filename = 'out.wav') {

  try{
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' }
        }
      }
    }
  });


  console.log("TTS Response:", JSON.stringify(response, null, 2));


  const data = response?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!data) 
    {throw new Error("TTS data is missing.no audio return");}

  const audioBuffer = Buffer.from(data, 'base64');

  const filePath = path.join(__dirname, 'public', filename);
  //  fs.writeFileSync(filePath, audioBuffer);
  
  const publicDir = path.join(__dirname, 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir);
    }

  await fs.promises.writeFile(filePath, audioBuffer)
  console.log(`✅ Audio saved to ${filePath}`);

  // ✅ Save wave file (in case needed)
    await saveWaveFile(filePath, audioBuffer);
}catch(err){
  console.log("TTS Generation Failed:", err.message);
  throw err;
}
  // await saveWaveFile(path.join(__dirname, 'public', filename), audioBuffer);

}

app.post('/ask', async (req, res) => {
  try {
    const { message } = req.body;

    History.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const result = await ai.models.generateContentStream({
      model: 'gemini-2.0-flash',
      contents: History,
      config: {
        systemInstruction: `You are "CodeBot by Coder Army " – an AI mentor that explains **coding concepts from absolute basics** in Rohit Negi's style.
 Follow these rules:

### Knowledge Delivery Protocol  
1. **Full Definition First:**  
   - Start with 1-sentence plain-language definition  
   - Follow with 1-sentence analogy (if needed)  
   *Example:*  
   *"Array ek data structure hai jo same type ke elements ko ek saath store karta hai. Samjho jaise kirayedar ka list ho! 📝"*

2. **Core Equation:**  
   - Show mathematical representation ONLY if simple  
   *Example:*  
   *"array = [item₁, item₂, ..., itemₙ]"*

3. **3-Funda Breakdown:**  
   - Explain exactly 3 key features with symbols  
    
   *Example:*  
   *"① Indexed Access → arr[0] = first element  
   ② Fixed Size → Memory ek saath allocate hota hai  
   ③ Same Data Type → All elements int/string/etc"*

4. **Complexity:**  
   - Must include time/space complexity  
   *Example:*  
   *"⏱️ Access Time: O(1) | 💾 Space: O(n)"*

5. **Challenge (Conditional):**  
   - Only if concept is simple:  
   *"Ab tum batao: Object explain karo?"*

### Communication Rules  
- **Language:** Strict Hinglish (Hindi sentences + English tech terms)  
- **Tone:** Rohit Negi style - energetic, mentor-like  
- **Word Limit:** Max 150 words (absolute hard cap)  
- **No Fluff:** Ban analogies unless critical for understanding  

      {important point if user ask question not releted to coadig reply {ruddly} ,in hardcode voice}
also use end words like chmka,clear,kuch to bolo pop-con khne aay ho kya.. use similar taunt and words which makes user connected `,
      }
    });
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Transfer-Encoding', 'chunked');

    let finalResponse = '';

    
    for await (const chunk of result) {
      if (chunk.text) {
        finalResponse += chunk.text;
        res.write(chunk.text); // send partial text to frontend
  }
}

await speakText(finalResponse);
res.end();
  

  } catch (error) {
    console.error("API or TTS Error:", error);
    res.status(500).json({ reply: "Something went wrong." });
  }
});

// ✅ Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Serve audio explicitly with correct headers
app.get('/out.wav', (req, res) => {
  res.setHeader('Content-Type', 'audio/wav');
  res.sendFile(path.join(__dirname, 'public', 'out.wav'));
});

app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});
