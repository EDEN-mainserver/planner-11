import google.generativeai as genai
import os

# API 키 설정
api_key = os.environ.get("GEMINI_API_KEY")
genai.configure(api_key=api_key)

# 모델 설정: 'gemini-1.5-flash'를 사용하되 정확한 식별자 사용
model = genai.GenerativeModel('gemini-1.5-flash')

def ask_gemini():
    print("🤖 Gemini 터미널 연동 성공!")
    print("대화를 종료하려면 '종료' 또는 'exit'를 입력하세요.")
    print("-" * 40)
    while True:
        try:
            user_input = input("나: ")
            if user_input.lower() in ['exit', 'quit', '종료']:
                print("👋 안녕히 가세요!")
                break
            
            if not user_input.strip():
                continue

            response = model.generate_content(user_input)
            print(f"\nGemini: {response.text}\n")
            print("-" * 40)
        except Exception as e:
            print(f"\n❌ 에러 발생: {e}")
            print("API 키가 유효한지, 혹은 네트워크 연결을 확인하세요.")
            break

if __name__ == "__main__":
    ask_gemini()
