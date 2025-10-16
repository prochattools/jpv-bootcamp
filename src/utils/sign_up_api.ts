import { BASE_URL, getToken } from "@/utils/axios-instance";
import toast from "react-hot-toast";

export async function postSignUp(username: string, paymentId: any) {
  const requestOptions = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken}`,
    },
    body: JSON.stringify({
      github_username: username,
      password: "1234",
      payment_id: paymentId,
    }),
  };

  const res = await fetch(`${BASE_URL}/api/auth/signup`, requestOptions);

  if (!res.ok) {
    const errorData = await res.json();
    toast.error(errorData?.error?.message || "Something went wrong.");
    // throw Error(errorData?.error?.message || "An error occurred");
    return;
  }

  const repo = await res.json();
  return repo;
}
