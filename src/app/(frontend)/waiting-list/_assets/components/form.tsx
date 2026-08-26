"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";

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
    <form onSubmit={handleSubmit} noValidate>
      <label htmlFor="waiting-list-email" className="sr-only">
        Email address
      </label>
      <Input
        id="waiting-list-email"
        type="email"
        placeholder="Your email address"
        className="mt-4 h-12"
        value={email}
        onChange={handleChange}
        aria-describedby={error ? "waiting-list-email-error" : undefined}
        autoComplete="email"
      />
      {error && (
        <p
          id="waiting-list-email-error"
          role="alert"
          className="mt-2 text-sm text-jpv-danger-ink"
        >
          {error}
        </p>
      )}
      <Button
        type="submit"
        className="mt-4 w-full sm:w-auto"
      >
        Join the waiting list
      </Button>
    </form>
  );
};

export default Form;
