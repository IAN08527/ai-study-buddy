import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const HF_ACCESS_TOKEN = process.env.HF_ACCESS_TOKEN;
const MODEL_ID = 'sentence-transformers/all-mpnet-base-v2';

async function testUrl(url) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + HF_ACCESS_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ inputs: 'This is a test' }),
  });
  console.log('Testing', url, '-> Status:', response.status);
  if (!response.ok) {
    console.error('Error:', await response.text());
  } else {
    const data = await response.json();
    console.log('Success, length:', data.length, typeof data[0]);
  }
}
async function run() {
  await testUrl('https://router.huggingface.co/hf-inference/models/' + MODEL_ID);
  await testUrl('https://router.huggingface.co/hf-inference/pipeline/feature-extraction/' + MODEL_ID);
}
run();
