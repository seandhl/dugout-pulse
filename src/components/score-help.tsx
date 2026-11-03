"use client";
import Link from "next/link";
import { Dialog } from "radix-ui";
export function ScoreHelp() {
  return (
    <Dialog.Root>
      <Dialog.Trigger className="text-button">
        기세 점수 이해하기 ⓘ
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="help-overlay" />
        <Dialog.Content className="help-dialog">
          <Dialog.Title>기세 점수는 공식 기록인가요?</Dialog.Title>
          <Dialog.Description>
            공식 기록이 아닌 자체 분석 점수입니다. 현재 모든 선수와 기록은 DEMO
            합성 데이터입니다.
          </Dialog.Description>
          <p>
            모델 momentum_v0_1_0 · 0–100점 · 50은 중립점입니다. 타자·선발·불펜은
            서로 다른 모델이므로 역할 사이의 점수를 비교하지 마세요.
          </p>
          <p>
            기세 변화량은 이전 비교 점수와의 차이입니다. 비교 자료가 없으면
            미제공으로 표시합니다. 신뢰도는 표본 충족 수준이며 예측 정확도가
            아닙니다.
          </p>
          <p>
            출처·시즌·대회·기준일·표본은 각 화면에서 확인하세요. 휴식·결장
            이유와 결측 기록은 추정하지 않습니다.
          </p>
          <Link href="/about#momentum-formula">
            산식·출처·데이터 한계 자세히 보기 →
          </Link>
          <Dialog.Close className="button">닫기</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
