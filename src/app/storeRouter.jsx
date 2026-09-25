import { createBrowserRouter } from 'react-router';
import { StoreShell } from '@components/layout/store/StoreShell';
import { HomePage } from '@pages/store/HomePage';
import { CategoryPage } from '@pages/store/CategoryPage';
import { ProductPage } from '@pages/store/ProductPage';
import { CartPage } from '@pages/store/CartPage';
import { CheckoutPage } from '@pages/store/CheckoutPage';
import { OrderConfirmationPage } from '@pages/store/OrderConfirmationPage';
import { OrderLookupPage } from '@pages/store/OrderLookupPage';
import { ReviewPage } from '@pages/store/ReviewPage';
import { ThreadPage } from '@pages/store/ThreadPage';
import { PaySimulatorPage } from '@pages/store/PaySimulatorPage';
import { ReceiptPage } from '@pages/store/ReceiptPage';
import { UnsubscribePage } from '@pages/store/UnsubscribePage';
import { RequestPage } from '@pages/store/RequestPage';
import { AboutPage } from '@pages/store/AboutPage';
import { ContactPage } from '@pages/store/ContactPage';
import { LegalPage } from '@pages/store/LegalPage';
import { FaqPage } from '@pages/store/FaqPage';
import { BlogPage } from '@pages/store/BlogPage';
import { BlogPostPage } from '@pages/store/BlogPostPage';
import { SearchPage } from '@pages/store/SearchPage';
import { SavedPage } from '@pages/store/SavedPage';
import { NotFoundPage } from '@pages/not-found/NotFoundPage';
import { STORE_ROUTES } from '@utils/constants';

export const storeRouter = createBrowserRouter([
  {
    element: <StoreShell />,
    children: [
      { path: STORE_ROUTES.HOME, element: <HomePage /> },
      // Same page, whole catalogue. The sub-sections become departments.
      { path: STORE_ROUTES.SHOP, element: <CategoryPage everything /> },
      { path: STORE_ROUTES.CATEGORY, element: <CategoryPage /> },
      { path: STORE_ROUTES.PRODUCT, element: <ProductPage /> },
      { path: STORE_ROUTES.CART, element: <CartPage /> },
      { path: STORE_ROUTES.CHECKOUT, element: <CheckoutPage /> },
      { path: STORE_ROUTES.ORDER_LOOKUP, element: <OrderLookupPage /> },
      // Reached only by the token link in the dispatch email.
      { path: STORE_ROUTES.REVIEW, element: <ReviewPage /> },
      // Reached only by the token in the email sent when the question was
      // asked. Order conversations are not here: they render on the order
      // page, which the customer already holds a link to.
      { path: STORE_ROUTES.THREAD, element: <ThreadPage /> },
      { path: STORE_ROUTES.PAY_SIMULATOR, element: <PaySimulatorPage /> },
      { path: STORE_ROUTES.RECEIPT, element: <ReceiptPage /> },
      { path: STORE_ROUTES.UNSUBSCRIBE, element: <UnsubscribePage /> },
      { path: STORE_ROUTES.REQUEST, element: <RequestPage /> },
      { path: STORE_ROUTES.ORDER_CONFIRMATION, element: <OrderConfirmationPage /> },
      { path: STORE_ROUTES.ABOUT, element: <AboutPage /> },
      { path: STORE_ROUTES.CONTACT, element: <ContactPage /> },
      { path: STORE_ROUTES.FAQ, element: <FaqPage /> },
      { path: STORE_ROUTES.LEGAL, element: <LegalPage /> },
      { path: STORE_ROUTES.BLOG, element: <BlogPage /> },
      { path: STORE_ROUTES.BLOG_POST, element: <BlogPostPage /> },
      // Both of these were linked from the header icons and neither existed,
      // so every use of the magnifying glass landed on the not-found page.
      { path: STORE_ROUTES.SEARCH, element: <SearchPage /> },
      { path: STORE_ROUTES.SAVED, element: <SavedPage /> },
      // The catch-all stays last. Everything above is an exact or parameter
      // match, so order only matters here.
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
