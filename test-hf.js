const fs = require('fs');
const envs = fs.readFileSync('.env.local', 'utf8').split('\n');
let HF_ACCESS_TOKEN = '';
for (const line of envs) {
  if (line.startsWith('HF_ACCESS_TOKEN=')) {
    HF_ACCESS_TOKEN = line.split('=')[1].trim();
  }
}
const MODEL_ID = 'sentence-transformers/all-mpnet-base-v2';

async function run() {
  const url = 'https://router.huggingface.co/hf-inference/models/' + MODEL_ID;
  console.log('Testing', url);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + HF_ACCESS_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        inputs: ['This is a test sentence.'],
        options: { wait_for_model: true }
      }),
    });
    console.log('Status:', res.status);
    if (!res.ok) console.error(await res.text());
    else {
      const data = await res.json();
      console.log('Success!', typeof data, Array.isArray(data) ? data.length : 'N/A');
      if (Array.isArray(data) && Array.isArray(data[0])) console.log('Inner size:', data[0].length);
    }
  } catch (err) {
    console.log('Error', err.message);
  }
}
run();
