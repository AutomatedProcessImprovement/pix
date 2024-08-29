// Auth and users backend API.

import { http, loginURL, passwordResetURL, userInfoURL, verifyURL } from "~/services/shared.server";
import type { User } from "./auth";

export async function getJWT(username: string, password: string): Promise<string | undefined> {
  console.log("Fetching URL:", loginURL);
  const usernameEncoded = encodeURIComponent(username);
  const passwordEncoded = encodeURIComponent(password);
  const response = await fetch(loginURL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `username=${usernameEncoded}&password=${passwordEncoded}`,
  });
  try {
    const data = await response.json();
    return data.access_token;
  } catch (e) {
    console.warn(`Error parsing/requesting JWT: ${e} -- Data: ${await response.text()}`);
    return;
  }
}

export async function getUserInfo(token: string): Promise<User> {
  const { data } = await http.get(userInfoURL, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return data as User;
}

export async function verifyEmail(token: string): Promise<boolean> {
  const response = await fetch(verifyURL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
  });
  if (!response.ok) throw new Error(response.statusText);
  return true;
}

export async function resetPassword(token: string, password: string): Promise<boolean> {
  const response = await fetch(passwordResetURL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token, password }),
  });
  if (!response.ok) {
    try {
      const data = await response.json();
      if ("detail" in data) console.error("Error resetting password:", data.detail);
    } catch (e) {
      console.error("Error resetting password:", e);
    }
    throw new Error(response.statusText);
  }
  return true;
}
