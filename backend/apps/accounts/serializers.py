from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User, Department


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "name_en", "name_ar", "code"]


class UserSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name_en", read_only=True)
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "email", "full_name_en", "full_name_ar",
            "role", "department", "department_name",
            "phone", "avatar", "avatar_url", "language",
            "is_active", "date_joined", "last_seen",
        ]
        read_only_fields = ["id", "date_joined", "last_seen"]

    def get_avatar_url(self, obj):
        request = self.context.get("request")
        if obj.avatar and request:
            return request.build_absolute_uri(obj.avatar.url)
        return None


class UserListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for dropdowns and mentions."""
    class Meta:
        model = User
        fields = ["id", "full_name_en", "full_name_ar", "email", "role", "avatar"]


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = [
            "email", "password", "full_name_en", "full_name_ar",
            "role", "department", "phone", "language",
        ]

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=8)

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect.")
        return value


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        # Add user info to login response
        data["user"] = UserSerializer(self.user, context=self.context).data
        return data
