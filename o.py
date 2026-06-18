from openai import OpenAI

client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key="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"
)

messages = []

print("MiniMax Chat started. Type 'exit' to stop.\n")

while True:
    user_input = input("You: ")

    if user_input.lower() == "exit":
        break

    messages.append({"role": "user", "content": user_input})

    response = client.chat.completions.create(
        model="minimaxai/minimax-m2.7",
        messages=messages,
        temperature=0.2,
        max_tokens=500
    )

    reply = response.choices[0].message.content
    print("AI:", reply)

    messages.append({"role": "assistant", "content": reply})