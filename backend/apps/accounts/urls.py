from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    # Auth
    path("login/", views.LoginView.as_view(), name="token_obtain_pair"),
    path("refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("logout/", views.LogoutView.as_view(), name="logout"),

    # Current user
    path("me/", views.MeView.as_view(), name="me"),
    path("me/change-password/", views.ChangePasswordView.as_view(), name="change_password"),

    # Users management
    path("users/", views.UserListCreateView.as_view(), name="users"),
    path("users/<uuid:pk>/", views.UserDetailView.as_view(), name="user_detail"),

    # Departments
    path("departments/", views.DepartmentListCreateView.as_view(), name="departments"),
    path("departments/<uuid:pk>/", views.DepartmentDetailView.as_view(), name="department_detail"),
]
