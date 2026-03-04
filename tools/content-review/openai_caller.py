from openai import OpenAI


def call_agent(
    client: OpenAI,
    model: str,
    temperature: float,
    system_prompt: str,
    content: str,
) -> str:
    response = client.chat.completions.create(
        model=model,
        temperature=temperature,
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    "Review and improve the following markdown content. "
                    "Return only the improved markdown:\n\n"
                    f"{content}"
                ),
            },
        ],
    )
    result = response.choices[0].message.content
    if not result:
        raise ValueError("OpenAI returned an empty response")
    return result
