FROM public.ecr.aws/lambda/python:3.12

# Copy requirements.txt
COPY requirements.txt ${LAMBDA_TASK_ROOT}

# Upgrade pip so it downloads modern pre-compiled wheels
RUN pip install --upgrade pip wheel setuptools

# Install Python packages
RUN pip install --no-cache-dir -r requirements.txt

# Copy all function code
COPY . ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD [ "main.handler" ]
