import { BASE_URL, getToken } from "@/utils/axios-instance";

export async function getServerSideData(url = "", check = false) {
  const res = await fetch(`${BASE_URL}/${url}`, {
    headers: {
      Authorization: `Bearer ${getToken}`,
    },
    cache: "no-cache",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch get data`);
  }

  const repo = await res.json();
  if (check) {
    return repo;
  } else {
    return repo?.data?.attributes;
  }
}
