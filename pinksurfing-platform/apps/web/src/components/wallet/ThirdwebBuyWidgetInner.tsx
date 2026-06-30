'use client';

import { BuyWidget, ThirdwebProvider } from 'thirdweb/react';
import { createThirdwebClient } from 'thirdweb';
import { base } from 'thirdweb/chains';

type Props = {
  clientId: string;
  amount: string;
};

export default function ThirdwebBuyWidgetInner({ clientId, amount }: Props) {
  const client = createThirdwebClient({ clientId });

  return (
    <ThirdwebProvider>
      <BuyWidget client={client} chain={base} amount={amount} title="Fund wallet" />
    </ThirdwebProvider>
  );
}
