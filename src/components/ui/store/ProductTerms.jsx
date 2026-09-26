import { Link } from 'react-router';
import { ReturnWindow } from '@components/ui/store/ReturnWindow';
import { PaymentMarks } from '@components/ui/store/PaymentMarks';
import styles from '@styles/ui/store/product-terms.module.css';

// Returns and payment under the delivery card; the statutory line is printed whatever the returns class, because the Act applies regardless.
export function ProductTerms({ product }) {
  return (
    <div className={styles.terms}>
      <div className={styles.pair}>
        <ReturnWindow product={product} />
        <PaymentMarks />
      </div>
      <p className={styles.statutory}>
        Faulty or not as described? Your rights under the Consumer Rights Act
        2015 apply whatever it says above. <Link to="/legal/returns">Full terms</Link>
      </p>
    </div>
  );
}
