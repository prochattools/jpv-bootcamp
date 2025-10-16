"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Toaster, toast } from "react-hot-toast";

const Form = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const handleChange = (e: any) => {
    setEmail(e.target.value);
    setError("");
  };

  const validateEmail = (email: string) => {
    // Basic email validation regex
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!email) {
      setError("Email is required.");
      return;
    }
    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    // console.log("email", email);
    try {
      // Make the POST request using fetch
      const response = await fetch("/api/waiting-list", {
        method: "POST", // Specify the request method
        headers: {
          "Content-Type": "application/json", // Specify the content type
        },
        body: JSON.stringify({ email: email }), // Convert the data object to a JSON string
      });

      // Check if the response is not OK (status code outside of the range 200-299)
      if (!response.ok) {
        throw new Error("Network response was not ok " + response.statusText);
      }

      // Parse the JSON from the response
      // const responseData = await response.json();

      // Handle the response data
      // console.log("Success:", responseData);
      toast.success("Successfully added to waiting list!");
      setEmail("");
    } catch (error) {
      console.error("Error:", error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Toaster position="top-center" reverseOrder={false} />
      <Input
        placeholder="Email"
        className="mt-8 mb-2"
        value={email}
        onChange={handleChange}
      />
      {error && <p className="text-red-500 mt-2 text-start">{error}</p>}
      <Button
        type="submit"
        className="w-[150px] mt-8 bg-[#006fee] border-none scale-1 hover:scale-[1.05] transition-all duration-300 hover:bg-[#006fee]"
      >
        Button
      </Button>
    </form>
  );
};

export default Form;
