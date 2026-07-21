import http from 'k6/http';
const testFile = open('./bigfile.bin', 'b');

export const option = {
  vus: 5,
  duration: '15s'
}

export default function () {
  http.post('http://localhost:3000/files/upload',testFile, {
    headers: {
      "Content-Type": 'application/octet-stream'
    }
  });
}