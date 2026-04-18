from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User, Department
from .serializers import (
    UserSerializer, UserCreateSerializer, UserListSerializer,
    DepartmentSerializer, ChangePasswordSerializer,
    CustomTokenObtainPairSerializer,
)
from .permissions import IsAdmin, IsAdminOrManager


class LoginThrottle(AnonRateThrottle):
    """Allow max 10 login attempts per minute per IP."""
    rate = "10/min"
    scope = "login"


class LoginView(TokenObtainPairView):
    permission_classes = [AllowAny]
    throttle_classes   = [LoginThrottle]  # 🔒 Brute-force protection
    serializer_class   = CustomTokenObtainPairSerializer


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data["refresh"]
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({"detail": "Logged out successfully."})
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class MeView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save()
        return Response({"detail": "Password changed successfully."})


class UserListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # ✔️ Only show ACTIVE users (fix for soft-delete not filtering)
        qs = User.objects.select_related("department").filter(is_active=True)
        # Allow admins to also see inactive users via ?include_inactive=1
        if self.request.user.is_admin and self.request.query_params.get("include_inactive"):
            qs = User.objects.select_related("department").all()
        return qs.order_by("full_name_en")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return UserCreateSerializer
        # Return lightweight list for non-admins
        if not self.request.user.is_manager:
            return UserListSerializer
        return UserSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAdmin()]
        return [IsAuthenticated()]


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.select_related("department")
    serializer_class = UserSerializer
    permission_classes = [IsAdminOrManager]

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user == request.user:
            return Response(
                {"detail": "Cannot delete yourself."},
                status=status.HTTP_400_BAD_REQUEST
            )
        user.is_active = False
        user.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DepartmentListCreateView(generics.ListCreateAPIView):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAdmin()]
        return [IsAuthenticated()]


class DepartmentDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [IsAdmin]
