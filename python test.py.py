from openai import OpenAI

client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key="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"
)

response = client.chat.completions.create(
    model="minimaxai/minimax-m2.7",
    messages=[
        {"role": "user", "content": "Hello, explain AI simply"}
    ],
    temperature=0.4,
    max_tokens=500
)

print(response.choices[0].message.content)