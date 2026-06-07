import { ProductDoctorPage } from "../../../../components/product-doctor-page";

export default function Page({ params }: { params: { id: string } }) {
  return <ProductDoctorPage productId={params.id} />;
}
