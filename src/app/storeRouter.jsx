import { createBrowserRouter } from 'react-router';
import { StoreShell } from '@components/layout/store/StoreShell';
import { HomePage } from '@pages/store/HomePage';
import { CategoryPage } from '@pages/store/CategoryPage';
import { ProductPage } from '@pages/store/ProductPage';
import { CartPage } from '@pages/store/CartPage';
import { CheckoutPage } from '@pages/store/CheckoutPage';
import { OrderConfirmationPage } from '@pages/store/OrderConfirmationPage';
import { LegalPage } from '@pages/store/LegalPage';
import { NotFoundPage } from '@pages/not-found/NotFoundPage';
import { STORE_ROUTES } from '@utils/constants';

export const storeRouter = createBrowserRouter([
  {
    element: <StoreShell />,
    children: [
      { path: STORE_ROUTES.HOME, element: <HomePage /> },
      { path: STORE_ROUTES.CATEGORY, element: <CategoryPage /> },
      { path: STORE_ROUTES.PRODUCT, element: <ProductPage /> },
      { path: STORE_ROUTES.CART, element: <CartPage /> },
      { path: STORE_ROUTES.CHECKOUT, element: <CheckoutPage /> },
      { path: STORE_ROUTES.ORDER_CONFIRMATION, element: <OrderConfirmationPage /> },
      { path: STORE_ROUTES.LEGAL, element: <LegalPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
