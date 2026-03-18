import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://hfkopnmphtqkapkcduec.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhma29wbm1waHRxa2Fwa2NkdWVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3OTA2OTgsImV4cCI6MjA4OTM2NjY5OH0.8anZ_tR5zQ6f7Q0tMUCa3GYsjevUn1Y57EhmJxgZqXk"
);

async function test() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "teste@primecredit.com",
    password: "010203123",
  });
  if (error) {
    console.error("Auth error", error);
    return;
  }
  const token = data.session.access_token;
  console.log("Logged in, token length:", token.length);

  const res = await fetch("http://localhost:3000/api/consultas/execute", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Cookie: `sb-hfkopnmphtqkapkcduec-auth-token=["${token}"]` // Using local cookie logic
    },
    body: JSON.stringify({
      consultationType: "basica_pf",
      document: "00000002305",
    }),
  });
  const json = await res.json();
  console.log("Status:", res.status);
  console.log("Response:", json);
}

test();
